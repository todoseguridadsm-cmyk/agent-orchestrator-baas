"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createN8nWorkflow, deleteN8nWorkflowByPrefix } from "@/lib/n8n";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { INDUSTRIES_REGISTRY } from "@/lib/industries";

// --- AUTHENTICATION ---

export async function loginUser(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: "Credenciales inválidas" };
  }

  // Verificar rol
  const { data: agency } = await supabase
    .from("agencies")
    .select("role")
    .eq("user_id", authData.user.id)
    .single();

  if (agency && agency.role === "superadmin") {
    redirect("/admin/agencies");
  } else {
    redirect("/projects");
  }
}

export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Obtiene el perfil de la agencia actual basado en la sesiÃƒÂ³n
export async function getCurrentAgency() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log("getCurrentAgency - user:", user?.id, "authError:", authError?.message);
  
  if (!user) return null;

  const { data: agency, error: dbError } = await supabase
    .from("agencies")
    .select("*")
    .eq("user_id", user.id)
    .single();

  console.log("getCurrentAgency - agency:", agency?.id, "dbError:", dbError?.message);

  return agency;
}

// --- SUPER ADMIN ACTIONS ---

export async function createAgency(formData: FormData) {
  const adminAgency = await getCurrentAgency();
  if (!adminAgency || adminAgency.role !== "superadmin") {
    return { success: false, error: "No autorizado" };
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // Para crear un usuario sorteando la confirmaciÃƒÂ³n de email y sin cerrar la sesiÃƒÂ³n actual,
  // usamos el Service Role Key con el cliente de Supabase JS estÃƒÂ¡ndar (no el de SSR).
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) {
    return { success: false, error: authError.message };
  }

  const { error: dbError } = await supabaseAdmin
    .from("agencies")
    .insert({
      user_id: userData.user.id,
      name,
      role: "agency"
    });

  if (dbError) {
    // Intento de rollback
    await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
    return { success: false, error: dbError.message };
  }

  revalidatePath("/admin/agencies");
  return { success: true };
}

// ============================================================================
// RESINCRONIZAR AGENTES (BACKUP / DISASTER RECOVERY)
// ============================================================================

export async function resyncAllAgents() {
  const supabase = await createClient();
  const agency = await getCurrentAgency();

  if (!agency || agency.role !== "superadmin") {
    return { success: false, error: "No autorizado. Solo Súper Administradores." };
  }

  try {
    const { data: settings } = await createServiceRoleClient().from("agency_settings").select("*").eq("agency_id", agency.id).single();
    if (!settings || !settings.n8n_url || !settings.n8n_api_key) {
      return { success: false, error: "N8N no está configurado en los ajustes." };
    }

    // Obtener todos los proyectos activos
    const { data: projects } = await supabase.from("projects").select("*").in("status", ["active", "deploying"]);
    
    if (!projects || projects.length === 0) {
      return { success: true, message: "No hay agentes para resincronizar." };
    }

    const { deleteN8nWorkflowByPrefix } = await import("@/lib/n8n");
    const { wahaStartSession } = await import("@/lib/waha");

    let successCount = 0;
    let failCount = 0;

    for (const proj of projects) {
      try {
        const prefix = `[${proj.id.substring(0, 6).toUpperCase()}]`;
        
        // 1. Borrar workflow viejo (si existe) para evitar duplicados
        await deleteN8nWorkflowByPrefix(
          { baseUrl: settings.n8n_url, apiKey: settings.n8n_api_key },
          prefix
        ).catch(() => {}); // ignorar errores si no existe

        // 2. Re-crear Workflow
        // capabilities las dejamos vacías por simplicidad en el backup, o extraemos de la DB si las hubiéramos guardado
        // (Nota: Actualmente capabilities no se guardan en projects, se podrían parsear del prompt, pero dejaremos [] para simplificar)
        const n8nWorkflowName = `${prefix} ${proj.name}`;
        const n8nResult = await createN8nWorkflow(
          { baseUrl: settings.n8n_url, apiKey: settings.n8n_api_key },
          n8nWorkflowName,
          proj.personality_prompt || "",
          proj.industry || "general",
          settings.waha_url || "",
          settings.waha_api_key || "",
          proj.id,
          [],
          settings.n8n_gemini_cred_id || undefined
        );

        if (n8nResult.success) {
          // 3. Actualizar URL
          await supabase.from("projects").update({ n8n_webhook_url: n8nResult.webhookUrl }).eq("id", proj.id);

          // 4. Reiniciar WAHA apuntando al nuevo webhook
          if (settings.waha_url) {
            await wahaStartSession(
              { url: settings.waha_url, apiKey: settings.waha_api_key || "" },
              proj.id,
              n8nResult.webhookUrl
            );
          }
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        console.error(`Error resincronizando proyecto ${proj.id}:`, e);
        failCount++;
      }
    }

    return { success: true, message: `Resincronización completada. Éxito: ${successCount}. Fallos: ${failCount}.` };
  } catch (error: any) {
    console.error("Error en resync:", error);
    return { success: false, error: error.message };
  }
}


// --- SETTINGS & PROJECTS ---

export async function saveSettings(formData: FormData) {
  const supabase = await createClient();
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };
  
  const agencyId = agency.id;
  
  const n8nUrl = formData.get("n8n_url") as string;
  const n8nKey = formData.get("n8n_key") as string;
  const wahaUrl = formData.get("waha_url") as string;
  const wahaKey = formData.get("waha_key") as string;
  const resendKey = formData.get("resend_key") as string;

  const { error } = await supabase
    .from("agency_settings")
    .upsert({
      agency_id: agencyId,
      n8n_url: n8nUrl,
      n8n_api_key: n8nKey,
      waha_url: wahaUrl,
      waha_api_key: wahaKey,
      resend_api_key: resendKey,
      updated_at: new Date().toISOString()
    }, { onConflict: "agency_id" });

  if (error) {
    console.error("Error guardando settings:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function createProject(formData: FormData, systemPrompt: string, capabilities: string[]) {
  const supabase = await createClient();
  const agency = await getCurrentAgency();

  if (!agency) return { success: false, error: "No autorizado" };

  const name = formData.get("project_name") as string;
  const industry = formData.get("industry") as string; // Ahora es texto libre
  const agencyId = agency.id;

  // Enforce limits
  const { count } = await supabase
    .from("projects")
    .select("*", { count: 'exact', head: true })
    .eq("agency_id", agencyId);

  const plan = agency.subscription_plan || 'starter';
  let limit = 1;
  if (plan === 'growth') limit = 4;
  if (plan === 'pro') limit = 10;
  if (plan === 'agency' || plan === 'agency_master') limit = 50;
  if (agency.role === 'superadmin') limit = 9999;

  if (count !== null && count >= limit) {
    return { success: false, error: `Has alcanzado el límite de ${limit} agente(s) de tu plan. Actualiza tu suscripción para crear más.` };
  }

  // --- GLOBAL ANTI-SPAM SHIELD (TRIAL LIMIT) ---
  if (agency.subscription_status === 'trialing' || plan === 'starter') {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentProjects, error: spamError } = await createServiceRoleClient()
      .from("projects")
      .select("id, agencies!inner(subscription_status)")
      .gte("created_at", threeDaysAgo)
      .eq("agencies.subscription_status", "trialing");
      
    if (!spamError && recentProjects && recentProjects.length >= 50) {
      return { success: false, error: "Alerta de seguridad: El sistema ha alcanzado el límite global de seguridad para creación de agentes de prueba. Por favor, intenta más tarde." };
    }
  }
  // --- PRE-ARMADO POR INDUSTRIA (Registro Universal) ---
  let finalPrompt = systemPrompt;
  const industryProfile = INDUSTRIES_REGISTRY[industry.toLowerCase()];
  
  if (industryProfile && industryProfile.systemPromptTemplate) {
    finalPrompt = industryProfile.systemPromptTemplate.replace("{{SYSTEM_PROMPT}}", systemPrompt);
  }
  // ---------------------------------------------

  const { data: project, error: dbError } = await supabase
    .from("projects")
    .insert({
      agency_id: agencyId,
      name,
      industry: industry || "general",
      status: "deploying",
      n8n_webhook_url: "",
      personality_prompt: finalPrompt,
      capabilities: capabilities
    })
    .select()
    .single();

  if (dbError) {
    console.error("Error en DB:", dbError);
    return { success: false, error: dbError.message };
  }

  try {
    // Obtener configuración global (del superadmin)
    const { data: superAdmin } = await createServiceRoleClient()
      .from("agencies")
      .select("id")
      .eq("role", "superadmin")
      .limit(1)
      .single();

    const { data: settings } = await createServiceRoleClient()
      .from("agency_settings")
      .select("*")
      .eq("agency_id", superAdmin?.id)
      .single();

    if (settings && settings.n8n_url && settings.n8n_api_key) {
      console.log(`Desplegando en n8n para: ${name}`);
      const n8nResult = await createN8nWorkflow(
        { baseUrl: settings.n8n_url, apiKey: settings.n8n_api_key },
        name,
        finalPrompt,
        project.industry,
        settings.waha_url || "",
        settings.waha_api_key || "",
        project.id,
        capabilities,
        settings.n8n_gemini_cred_id || undefined
      );
      
      if (n8nResult.success) {
        // Actualizar el proyecto con el Webhook URL devuelto por n8n
        await supabase
          .from("projects")
          .update({ n8n_webhook_url: n8nResult.webhookUrl })
          .eq("id", project.id);
      } else {
        throw new Error(`Fallo en n8n: ${n8nResult.error}`);
      }
    }

    if (settings && settings.waha_url) {
      console.log(`Simulando sesiÃƒÂ³n WAHA para: ${project.id}`);
    }

    await supabase
      .from("projects")
      .update({ status: "active" })
      .eq("id", project.id);

    revalidatePath("/projects");
    return { success: true, projectId: project.id };

  } catch (err: any) {
    console.error("Error global deploy:", err);
    return { success: false, error: err.message };
  }
}

export async function deleteProject(formData: FormData) {
  const supabase = await createClient();
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const projectId = formData.get("projectId") as string;
  if (!projectId) return { success: false, error: "ID faltante" };

  // 1. Obtener datos del proyecto para limpiar n8n y WAHA
  const { data: project } = await supabase.from("projects").select("name").eq("id", projectId).eq("agency_id", agency.id).single();
  
  if (project) {
    const { data: settings } = await createServiceRoleClient().from("agency_settings").select("n8n_url, n8n_api_key, waha_url, waha_api_key").eq("agency_id", agency.id).single();
    
    if (settings) {
      // 2. Limpiar sesiÃƒÂ³n de WAHA (ignora errores si no existe)
      if (settings.waha_url && settings.waha_api_key) {
        const baseUrl = settings.waha_url.replace(/\/$/, "");
        await fetch(`${baseUrl}/api/sessions/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": settings.waha_api_key },
          body: JSON.stringify({ name: projectId })
        }).catch(() => {});
      }

      // 3. Limpiar workflow de n8n buscando por nombre y prefijo
      if (settings.n8n_url && settings.n8n_api_key) {
        const { deleteN8nWorkflowByPrefix } = await import("@/lib/n8n");
        const wfPrefix = `[${projectId.substring(0, 6).toUpperCase()}]`;
        await deleteN8nWorkflowByPrefix(
          { baseUrl: settings.n8n_url, apiKey: settings.n8n_api_key },
          wfPrefix
        ).catch(console.error);

        // También intentar borrar por el nombre exacto por si acaso
        try {
          const n8nBaseUrl = settings.n8n_url.replace(/\/$/, "");
          const wfsRes = await fetch(`${n8nBaseUrl}/api/v1/workflows?limit=1000`, {
            headers: { "X-N8N-API-KEY": settings.n8n_api_key }
          });
          if (wfsRes.ok) {
            const wfsData = await wfsRes.json();
            const toDelete = wfsData.data?.filter((w: any) => w.name && w.name.includes(project.name));
            for (const wf of (toDelete || [])) {
              await fetch(`${n8nBaseUrl}/api/v1/workflows/${wf.id}/deactivate`, { method: "POST", headers: { "X-N8N-API-KEY": settings.n8n_api_key } }).catch(() => {});
              await fetch(`${n8nBaseUrl}/api/v1/workflows/${wf.id}`, { method: "DELETE", headers: { "X-N8N-API-KEY": settings.n8n_api_key } }).catch(() => {});
            }
          }
        } catch (e) {
          console.error("Error limpiando n8n por nombre:", e);
        }
      }
    }
  }

  // 4. Borrar todas las tablas asociadas (para liberar memoria y espacio)
  await supabase.from("messages").delete().eq("conversation_id", projectId);
  await supabase.from("conversations").delete().eq("project_id", projectId);
  await supabase.from("appointments").delete().eq("project_id", projectId);
  await supabase.from("products").delete().eq("project_id", projectId);
  await supabase.from("crm_clients").delete().eq("project_id", projectId);

  // 5. Borrar el proyecto de la base de datos
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("agency_id", agency.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/projects");
  return { success: true };
}

// ============================================================================
// FASE 2: GESTIÃƒâ€œN DE CATÃƒÂ LOGO (KNOWLEDGE BASE)
// ============================================================================

export async function uploadProductImage(formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("file") as File;
  const projectId = formData.get("projectId") as string;
  
  if (!file || !projectId) {
    return { success: false, error: "Archivo o Proyecto faltante." };
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${projectId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase
    .storage
    .from('knowledge_base')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error("Storage upload error:", error);
    return { success: false, error: error.message };
  }

  const { data: publicUrlData } = supabase
    .storage
    .from('knowledge_base')
    .getPublicUrl(fileName);

  return { success: true, url: publicUrlData.publicUrl };
}

export async function addProduct(formData: FormData) {
  const supabase = await createClient();
  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string) || 0;
  const category = formData.get("category") as string;
  const is_active = formData.get("is_active") === "on" || formData.get("is_active") === "true";
  const stock = parseInt(formData.get("stock") as string) || 0;
  const ai_instructions = formData.get("ai_instructions") as string;
  const imageUrl = formData.get("image_url") as string;
  let metadata = {};
  if (formData.has("metadata")) {
    try {
      metadata = JSON.parse(formData.get("metadata") as string);
    } catch (e) {}
  }

  const { error } = await supabase
    .from("products")
    .insert([{
      project_id: projectId,
      name,
      description,
      price,
      stock,
      category,
      is_active,
      ai_instructions,
      image_url: imageUrl || null,
      metadata
    }]);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function deleteProduct(productId: string, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// ============================================================================
// FASE 3: VINCULACIÃƒâ€œN WAHA (WHATSAPP AUTÃƒâ€œNOMO)
// ============================================================================

import { wahaStartSession, wahaGetQr, wahaGetStatus } from "@/lib/waha";

export async function linkWahaSession(projectId: string) {
  const supabase = await createClient();
  
  // 1. Obtener credenciales WAHA de la agencia (Global SuperAdmin)
  const { data: superAdmin } = await createServiceRoleClient().from("agencies").select("id").eq("role", "superadmin").limit(1).single();
  const { data: project } = await supabase.from("projects").select("agency_id, n8n_webhook_url").eq("id", projectId).single();
  if (!project) return { success: false, error: "Proyecto no encontrado" };
  
  const { data: settings } = await createServiceRoleClient().from("agency_settings").select("waha_url, waha_api_key").eq("agency_id", superAdmin?.id).single();
  if (!settings || !settings.waha_url) return { success: false, error: "URL de WAHA no configurada en Ajustes Globales (SuperAdmin)" };

  // 2. Iniciar sesiÃƒÂ³n pasando el Webhook URL (si existe)
  const startResult = await wahaStartSession(
    { url: settings.waha_url, apiKey: settings.waha_api_key || "" }, 
    projectId,
    project.n8n_webhook_url || undefined
  );
  
  if (!startResult.success) {
    // Si ya existe la sesiÃƒÂ³n, no pasa nada, continuamos a pedir el QR
    console.warn("wahaStartSession alert:", startResult.error);
  }

  // 3. Actualizar estado en DB
  await supabase.from("projects").update({ waha_session_id: projectId, waha_status: "SCAN_QR_CODE" }).eq("id", projectId);

  return { success: true };
}

// ============================================================================
// CANCELACIÓN DE SUSCRIPCIÓN
// ============================================================================
export async function cancelSubscription() {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const supabase = await createClient();
  
  if (!agency.mp_subscription_id) {
    // Si no tiene ID de MercadoPago, solo lo cancelamos localmente
    await supabase.from("agencies").update({ subscription_status: "canceled" }).eq("id", agency.id);
    return { success: true };
  }

  // Obtener Token del SuperAdmin
  const { data: superAdmin } = await createServiceRoleClient().from("agencies").select("saas_mp_access_token").eq("role", "superadmin").limit(1).single();
  
  if (superAdmin && superAdmin.saas_mp_access_token) {
    try {
      const response = await fetch(`https://api.mercadopago.com/preapproval/${agency.mp_subscription_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${superAdmin.saas_mp_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: "cancelled" })
      });
      
      if (!response.ok) {
        console.error("MercadoPago Cancel Error:", await response.text());
        // Aun así procedemos a cancelarlo localmente
      }
    } catch (err) {
      console.error("Fetch MP Error:", err);
    }
  }

  // Cancelar localmente y expulsar al trial/expirado
  await supabase.from("agencies").update({ subscription_status: "canceled", trial_ends_at: new Date(0).toISOString() }).eq("id", agency.id);
  
  // Borrado de N8N y WAHA (Inmediato)
  await deleteAgencyData(agency.id);

  return { success: true };
}

// ============================================================================
// HELPER PARA BORRADO DURO (N8N y WAHA)
// ============================================================================
export async function deleteAgencyData(agencyId: string) {
  const supabase = await createClient();
  
  const { data: superAdmin } = await createServiceRoleClient().from("agencies").select("id").eq("role", "superadmin").limit(1).single();
  if (!superAdmin) return;
  
  const { data: settings } = await createServiceRoleClient().from("agency_settings").select("*").eq("agency_id", superAdmin.id).single();
  if (!settings) return;

  const { data: projects } = await supabase.from("projects").select("id").eq("agency_id", agencyId);
  if (!projects || projects.length === 0) return;

  const { wahaStopSession } = await import("@/lib/waha");
  const { deleteN8nWorkflowByPrefix } = await import("@/lib/n8n");

  for (const proj of projects) {
    // Apagar sesión WAHA (liberar RAM)
    if (settings.waha_url) {
      await wahaStopSession(
        { url: settings.waha_url, apiKey: settings.waha_api_key || "" }, 
        proj.id
      ).catch(console.error);
    }
    // Eliminar workflow N8N
    if (settings.n8n_url && settings.n8n_api_key) {
      const prefix = `[${proj.id.substring(0, 6).toUpperCase()}]`;
      await deleteN8nWorkflowByPrefix(
        { baseUrl: settings.n8n_url, apiKey: settings.n8n_api_key },
        prefix
      ).catch(console.error);
    }
  }

  // Marcar los proyectos como "borrados/suspendidos" para que no queden activos,
  // pero conservamos la tabla por si vuelven a pagar (así ven cómo se llamaban sus agentes)
  await supabase.from("projects").update({ status: "suspended", n8n_webhook_url: "" }).eq("agency_id", agencyId);
}

// ============================================================================
// MARCA BLANCA (WHITE LABEL)
// ============================================================================

export async function uploadWhiteLabelLogo(formData: FormData) {
  const supabase = await createClient();
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const file = formData.get("file") as File;
  if (!file) return { success: false, error: "Archivo faltante" };

  const fileExt = file.name.split('.').pop();
  const fileName = `whitelabel/${agency.id}_${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage.from("knowledge_base").upload(fileName, file, {
    cacheControl: "3600",
    upsert: true
  });

  if (error) {
    console.error("Storage upload error:", error);
    return { success: false, error: error.message };
  }

  const { data: publicUrlData } = supabase.storage.from("knowledge_base").getPublicUrl(fileName);
  return { success: true, url: publicUrlData.publicUrl };
}

export async function saveWhiteLabelSettings(formData: FormData) {
  const supabase = await createClient();
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  // Validar permisos
  if (agency.subscription_plan !== "pro" && agency.subscription_plan !== "agency_master" && agency.role !== "superadmin") {
    return { success: false, error: "Tu plan actual no incluye Marca Blanca. Actualiza tu suscripción para acceder a esta función." };
  }

  const name = formData.get("white_label_name") as string;
  const logoUrl = formData.get("white_label_logo") as string;

  const { error } = await supabase
    .from("agencies")
    .update({
      white_label_name: name || null,
      white_label_logo: logoUrl || null
    })
    .eq("id", agency.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/projects");
  revalidatePath("/projects/whitelabel");
  return { success: true };
}

export async function fetchWahaQr(projectId: string) {
  const supabase = await createClient();
  const { data: superAdmin } = await createServiceRoleClient().from("agencies").select("id").eq("role", "superadmin").limit(1).single();
  const { data: project } = await supabase.from("projects").select("agency_id").eq("id", projectId).single();
  if (!project) return { success: false, error: "Proyecto no encontrado" };
  
  const { data: settings } = await createServiceRoleClient().from("agency_settings").select("waha_url, waha_api_key").eq("agency_id", superAdmin?.id).single();
  if (!settings || !settings.waha_url) return { success: false, error: "Sin config WAHA global" };

  const qrResult = await wahaGetQr({ url: settings.waha_url, apiKey: settings.waha_api_key || "" }, projectId);
  if (!qrResult.success) return { success: false, error: qrResult.error };

  if (qrResult.status === "WORKING") {
    await supabase.from("projects").update({ waha_status: "WORKING" }).eq("id", projectId);
    return { success: true, status: "WORKING" };
  }

  return { success: true, qr: qrResult.qr };
}

export async function pollWahaStatus(projectId: string) {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("agency_id").eq("id", projectId).single();
  if (!project) return { success: false, error: "Proyecto no encontrado" };
  
  const { data: superAdmin } = await createServiceRoleClient().from("agencies").select("id").eq("role", "superadmin").limit(1).single();
  const { data: settings } = await createServiceRoleClient().from("agency_settings").select("waha_url, waha_api_key").eq("agency_id", superAdmin?.id).single();
  if (!settings || !settings.waha_url) return { success: false, error: "Sin config WAHA global" };

  const statusResult = await wahaGetStatus({ url: settings.waha_url, apiKey: settings.waha_api_key || "" }, projectId);
  
  if (statusResult.success && statusResult.status === 'WORKING') {
    await supabase.from("projects").update({ waha_status: "Conectado" }).eq("id", projectId);
    revalidatePath(`/projects/${projectId}`);
  }

  // Update real status if failed
  if (!statusResult.success || statusResult.status === 'FAILED') {
    await supabase.from("projects").update({ waha_status: "Error" }).eq("id", projectId);
    revalidatePath(`/projects/${projectId}`);
  }
  
  return statusResult;
}

export async function restartWahaSession(projectId: string) {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("agency_id, n8n_webhook_url").eq("id", projectId).single();
  if (!project) return { success: false, error: "Proyecto no encontrado" };

  const { data: superAdmin } = await createServiceRoleClient().from("agencies").select("id").eq("role", "superadmin").limit(1).single();
  const { data: settings } = await createServiceRoleClient().from("agency_settings").select("waha_url, waha_api_key").eq("agency_id", superAdmin?.id).single();
  if (!settings || !settings.waha_url) return { success: false, error: "URL de WAHA no configurada globalmente" };

  const { wahaRestartSession } = await import("@/lib/waha");
  const result = await wahaRestartSession(
    { url: settings.waha_url, apiKey: settings.waha_api_key || "" },
    projectId,
    project.n8n_webhook_url || undefined
  );

  if (result.success) {
    await supabase.from("projects").update({ waha_status: "SCAN_QR_CODE" }).eq("id", projectId);
    revalidatePath(`/projects/${projectId}`);
  }

  return result;
}

// ============================================================================
// FASE 4: AJUSTES GLOBALES (API KEYS)
// ============================================================================

export async function saveCompanySettings(projectId: string, formData: FormData) {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const supabase = await createClient();
  const updateData = {
    company_name: formData.get("company_name") || null,
    company_cuit: formData.get("company_cuit") || null,
    company_address: formData.get("company_address") || null,
    company_phone: formData.get("company_phone") || null,
    company_email: formData.get("company_email") || null,
    owner_phone: formData.get("owner_phone") || null,
    tax_category: formData.get("tax_category") || "monotributo",
    vacation_mode: formData.get("vacation_mode") === "true",
    vacation_message: formData.get("vacation_message") || null,
  };

  const { error } = await supabase.from("projects").update(updateData).eq("id", projectId).eq("agency_id", agency.id);

  if (error) {
    console.error("Error saving company settings:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function saveAfipSettings(projectId: string, formData: FormData) {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const supabase = await createClient();
  const updateData = {
    afip_crt: formData.get("afip_crt") || null,
    afip_key: formData.get("afip_key") || null,
    afip_pto_vta: formData.get("afip_pto_vta") ? parseInt(formData.get("afip_pto_vta") as string, 10) : null,
    afip_active: formData.get("afip_active") === "true",
  };

  const { error } = await supabase.from("projects").update(updateData).eq("id", projectId).eq("agency_id", agency.id);

  if (error) {
    console.error("Error saving afip settings:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// ============================================================================
// FASE 5: CAMPAÃƒâ€˜AS MASIVAS (BROADCAST)
// ============================================================================

export async function startCampaign(projectId: string, name: string, message: string, imageUrl: string | null, targetPhones: string[]) {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const supabase = await createClient();
  
  // 1. Guardar campaÃƒÂ±a en DB
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .insert({
      project_id: projectId,
      name,
      message,
      image_url: imageUrl,
      target_audiences: targetPhones,
      status: "running"
    })
    .select()
    .single();

  if (campErr || !campaign) {
    return { success: false, error: campErr?.message || "Error al crear campaÃƒÂ±a" };
  }

  const { data: superAdmin } = await createServiceRoleClient().from("agencies").select("id").eq("role", "superadmin").limit(1).single();
  const { data: settings } = await createServiceRoleClient().from("agency_settings").select("waha_url, waha_api_key").eq("agency_id", superAdmin?.id).single();
  if (!settings || !settings.waha_url) {
    await supabase.from("campaigns").update({ status: "error" }).eq("id", campaign.id);
    return { success: false, error: "WAHA global no estÃƒÂ¡ configurado" };
  }

  const wahaBaseUrl = settings.waha_url.replace(/\/$/, "");

  // 2. Ejecutar envÃƒÂ­os en "background" (sin await para no bloquear la respuesta)
  // Nota: En un entorno Serverless estricto como Vercel libre, esto podrÃƒÂ­a cortarse.
  // Para Vercel Pro/Node.js, esto correrÃƒÂ¡ en segundo plano.
  (async () => {
    for (const phone of targetPhones) {
      try {
        let endpoint = `${wahaBaseUrl}/api/sendText`;
        let payload: any = {
          chatId: `${phone}@c.us`,
          text: message,
          session: projectId
        };

        if (imageUrl) {
          endpoint = `${wahaBaseUrl}/api/sendImage`;
          payload = {
            chatId: `${phone}@c.us`,
            file: { url: imageUrl },
            caption: message,
            session: projectId
          };
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": settings.waha_api_key || ""
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Status " + res.status);

        await supabase.from("campaign_logs").insert({
          campaign_id: campaign.id,
          phone: phone,
          status: "sent"
        });

      } catch (err: any) {
        await supabase.from("campaign_logs").insert({
          campaign_id: campaign.id,
          phone: phone,
          status: "failed",
          error_msg: err.message
        });
      }

      // 3. Pausa de 4 segundos obligatoria para evitar baneo
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    // Al finalizar todos
    await supabase.from("campaigns").update({ status: "completed" }).eq("id", campaign.id);
  })();

  return { success: true, campaignId: campaign.id };
}

export async function saveAgencySettings(formData: FormData) {
  const supabase = await createClient();
  const agency = await getCurrentAgency();
  
  if (!agency) {
    return { success: false, error: "No autenticado" };
  }

  const n8n_url = formData.get("n8n_url") as string;
  const n8n_api_key = formData.get("n8n_api_key") as string;
  const n8n_gemini_cred_id = formData.get("n8n_gemini_cred_id") as string;
  const waha_url = formData.get("waha_url") as string;
  const waha_api_key = formData.get("waha_api_key") as string;
  const resend_api_key = formData.get("resend_api_key") as string;

  const { error } = await supabase
    .from("agency_settings")
    .upsert({
      agency_id: agency.id,
      n8n_url,
      n8n_api_key,
      n8n_gemini_cred_id,
      waha_url,
      waha_api_key,
      resend_api_key,
      updated_at: new Date().toISOString()
    });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

// --- UPDATE AGENT PROMPT ---
export async function updateAgentPrompt(projectId: string, newPrompt: string) {
  const supabase = await createClient();
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  // 1. Obtener proyecto
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, industry")
    .eq("id", projectId)
    .eq("agency_id", agency.id)
    .single();

  if (!project) return { success: false, error: "Proyecto no encontrado" };

  // 2. Guardar en Supabase
  const { error: dbError } = await supabase
    .from("projects")
    .update({ personality_prompt: newPrompt })
    .eq("id", projectId);

  if (dbError) return { success: false, error: dbError.message };

  // 3. Modificar flujo en n8n
  const { data: settings } = await supabase
    .from("agency_settings")
    .select("n8n_url, n8n_api_key, waha_url, waha_api_key, n8n_gemini_cred_id")
    .eq("agency_id", agency.id)
    .single();

  if (settings && settings.n8n_url && settings.n8n_api_key) {
    const n8nBaseUrl = settings.n8n_url.replace(/\/$/, "");
    try {
      // a) Buscar el workflow por nombre
      const wfsRes = await fetch(`${n8nBaseUrl}/api/v1/workflows`, {
        headers: { "X-N8N-API-KEY": settings.n8n_api_key }
      });
      if (wfsRes.ok) {
        const wfsData = await wfsRes.json();
        const wfToUpdate = wfsData.data?.find((w: any) => w.name && w.name.includes(`Agente: ${project.name}`));
        
        if (wfToUpdate) {
          // b) Obtener el JSON completo del workflow
          const wfDetailRes = await fetch(`${n8nBaseUrl}/api/v1/workflows/${wfToUpdate.id}`, {
            headers: { "X-N8N-API-KEY": settings.n8n_api_key }
          });
          
          if (wfDetailRes.ok) {
            const fullWf = await wfDetailRes.json();
            
            // c) Encontrar el nodo de la IA y actualizarlo
            let updated = false;
            if (fullWf.nodes && Array.isArray(fullWf.nodes)) {
              for (const node of fullWf.nodes) {
                if (node.name === "AI Agent" || (node.type && node.type.includes("langchain.agent"))) {
                  if (!node.parameters) node.parameters = {};
                  if (!node.parameters.options) node.parameters.options = {};
                  
                  const antiLoopRule = `\n\nREGLA CRÃƒÂTICA ANTI-BUCLES: Si detectas que estÃƒÂ¡s hablando con otro Bot automÃƒÂ¡tico o contestador (ej: responde cosas como "Gracias por comunicarte", "En breve te atenderemos", o envÃƒÂ­a un menÃƒÂº repetitivo), DEBES detener la conversaciÃƒÂ³n para evitar un bucle infinito. Responde ÃƒÅ¡NICA Y EXACTAMENTE con esta palabra secreta: SILENCIO_BOT`;
                  
                  node.parameters.options.systemMessage = `${newPrompt}${antiLoopRule}`;
                  updated = true;
                  break;
                }
              }
            }
            
            // d) Guardar los cambios en n8n
            if (updated) {
              const putRes = await fetch(`${n8nBaseUrl}/api/v1/workflows/${wfToUpdate.id}`, {
                method: "PUT",
                headers: { 
                  "X-N8N-API-KEY": settings.n8n_api_key,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(fullWf)
              });
              
              if (!putRes.ok) {
                console.error("Fallo al actualizar n8n:", await putRes.text());
                return { success: false, error: "Fallo al guardar en n8n" };
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error("Error al actualizar workflow en n8n", e);
      return { success: false, error: e.message };
    }
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

// --- GEMINI PROMPT GENERATOR ---
export async function generateDynamicPrompt(industry: string, capabilities: string[]) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const capsText = capabilities.map(c => `- ${c}`).join("\n");
    const rulesText = `REGLAS ESTRICTAS PARA VENTAS:
- NUNCA reveles la cantidad exacta de stock disponible al cliente a menos que pregunte explÃƒÂ­citamente cuÃƒÂ¡ntas unidades quedan.
- Si el cliente no especifica cantidad, asume que quiere 1. Si hay stock, simplemente ofrÃƒÂ©celo sin mencionar el stock.
- Si el cliente pide una cantidad especÃƒÂ­fica (ej. "quiero 2") y hay stock suficiente, dile que sÃƒÂ­ hay disponibilidad sin decirle el nÃƒÂºmero total que tienes.
- Si el cliente pide mÃƒÂ¡s unidades de las que hay disponibles, dile amablemente: "Solo contamos con X unidades en este momento".

REGLAS ESTRICTAS PARA TURNOS Y AGENDAMIENTO:
- Si el cliente quiere agendar un turno, PRIMERO verifica los horarios de atenciÃƒÂ³n y el costo de consulta en tu tabla de conocimiento.
- LUEGO, pregÃƒÂºntale para quÃƒÂ© dÃƒÂ­a lo quiere. Usa la herramienta "Gestor de Turnos" (action='check') para ver quÃƒÂ© horarios estÃƒÂ¡n OCUPADOS ese dÃƒÂ­a.
- Ofrece al cliente ÃƒÅ¡NICAMENTE los horarios que estÃƒÂ©n DENTRO del horario de atenciÃƒÂ³n y que NO estÃƒÂ©n ocupados.
- Para guardar el turno, debes usar la herramienta "Gestor de Turnos" (action='book').
- ANTES de guardar el turno, es OBLIGATORIO pedirle al cliente: Nombre, Apellido, y DNI.
- ${industry.toLowerCase().includes("salud") || industry.toLowerCase().includes("medicin") || industry.toLowerCase().includes("mÃƒÂ©dic") || industry.toLowerCase().includes("odontolog") || industry.toLowerCase().includes("psicolog") || industry.toLowerCase().includes("clinic") ? "Al ser del rubro salud, es OBLIGATORIO preguntarle al cliente si tiene Mutual u Obra Social (y cuÃƒÂ¡l) antes de agendar." : "NO le preguntes si tiene mutual u obra social (no aplica a tu rubro)."}
- Antes de confirmar, infÃƒÂ³rmale el costo del turno (si estÃƒÂ¡ definido en tu conocimiento) para evitar malentendidos.

REGLAS ESTRICTAS PARA COBROS:
- Si el cliente dice que quiere comprar algo, pregÃƒÂºntale cÃƒÂ³mo quiere pagar (Efectivo o Mercado Pago).
- Si elige Mercado Pago, usa la herramienta "Generar Pago" indicando el producto y precio exacto que le pasaste.
- Dile al cliente: "AquÃƒÂ­ tienes tu link de pago seguro: [LINK]. AvÃƒÂ­same cuando hayas pagado para verificarlo."
- Cuando el cliente te diga "Ya paguÃƒÂ©" o similar, DEBES obligatoriamente usar la herramienta "Verificar Pago" con su nÃƒÂºmero de telÃƒÂ©fono para ver si ingresÃƒÂ³ el pago.
- Nunca le digas que el pago estÃƒÂ¡ confirmado si la herramienta "Verificar Pago" te dice que no hay pagos aprobados.
- IMPORTANTE: Si deciden pagar en cuotas, explÃƒÂ­cales que Mercado Pago podrÃƒÂ­a cobrarles un pequeÃƒÂ±o recargo por financiaciÃƒÂ³n que verÃƒÂ¡n al abrir el link. TÃƒÂº no te haces cargo de los intereses.`;

    const prompt = `ActÃƒÂºa como un experto ingeniero de prompts. Tienes que crear un System Prompt maestro para un bot de WhatsApp.
El negocio es del rubro: ${industry}.
El bot debe tener un tono profesional, amable y servicial, con un ligerÃƒÂ­simo toque argentino (puedes usar "vos"), pero absolutamente SIN usar jerga informal, insultos, ni palabras como "garrÃƒÂ³n", "bronca", "che", etc. Debe sonar como un vendedor profesional y educado.

El bot tiene acceso a las siguientes herramientas automÃƒÂ¡ticas (solo menciona en el prompt las que tengan sentido con estas capacidades):
${capsText}

${rulesText}

Redacta el System Prompt en primera persona del singular ("Eres un asistente..."). El prompt debe indicarle al bot cÃƒÂ³mo saludar, cÃƒÂ³mo ayudar al cliente, y hacer hincapiÃƒÂ© en que si el cliente quiere comprar, use la herramienta de catÃƒÂ¡logo, y si quiere agendar, use la de turnos (segÃƒÂºn corresponda).
Devuelve SOLO el texto del prompt, sin comillas ni introducciones.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { success: true, prompt: response.text() };
  } catch (error: any) {
    console.error("Error generating prompt:", error);
    return { success: false, error: error.message };
  }
}

// --- LIVE CHAT ACTIONS ---
export async function sendChatMessage(conversationId: string, projectId: string, phone: string, text: string) {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const supabase = await createClient();

  // Obtener WAHA settings
  const { data: settings } = await supabase
    .from("agency_settings")
    .select("waha_url, waha_api_key")
    .eq("agency_id", agency.id)
    .single();

  if (!settings || !settings.waha_url || !settings.waha_api_key) {
    return { success: false, error: "WAHA no estÃƒÂ¡ configurado" };
  }

  try {
    // 1. Enviar mensaje por WAHA
    const wahaBaseUrl = settings.waha_url.replace(/\/$/, "");
    const res = await fetch(`${wahaBaseUrl}/api/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": settings.waha_api_key,
      },
      body: JSON.stringify({
        chatId: `${phone}@c.us`,
        text: text,
        session: projectId
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: "Error enviando a WAHA: " + err };
    }

    // 2. Pausar bot y guardar mensaje
    await supabase.from("conversations").update({ bot_paused: true }).eq("id", conversationId);
    
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "human",
      content: text
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- MERCADO PAGO ACTIONS ---
export async function getMercadoPagoPayments(projectId: string) {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const supabase = await createClient();

  // 1. Obtener token del proyecto
  const { data: project } = await supabase
    .from("projects")
    .select("mp_access_token")
    .eq("id", projectId)
    .eq("agency_id", agency.id)
    .single();

  if (!project || !project.mp_access_token) {
    return { success: false, error: "Mercado Pago no estÃƒÂ¡ configurado." };
  }

  try {
    // 2. Fetch pagos de MP
    const res = await fetch("https://api.mercadopago.com/v1/payments/search?status=approved&sort=date_created&criteria=desc&limit=50", {
      headers: {
        "Authorization": `Bearer ${project.mp_access_token}`
      },
      cache: "no-store"
    });

    if (!res.ok) throw new Error("Error consultando MP API");
    const data = await res.json();

    const payments = data.results || [];

    // 3. Cruzar con nombres de conversaciones
    const { data: conversations } = await supabase
      .from("conversations")
      .select("client_phone, client_name")
      .eq("project_id", projectId);

    const phoneToName = new Map();
    if (conversations) {
      conversations.forEach(c => {
        if (c.client_name) phoneToName.set(c.client_phone, c.client_name);
      });
    }

    // 4. Obtener facturas emitidas para marcar los pagos facturados
    const { data: invoices } = await supabase
      .from("invoices")
      .select("payment_id")
      .eq("project_id", projectId);
      
    const billedPaymentIds = new Set(invoices?.map(i => i.payment_id) || []);

    const formattedPayments = payments.map((p: any) => ({
      id: p.id,
      date: p.date_created,
      amount: p.transaction_amount,
      description: p.description,
      phone: p.external_reference || "Desconocido",
      client_name: p.external_reference ? phoneToName.get(p.external_reference) || "Sin nombre" : "Sin nombre",
      isBilled: billedPaymentIds.has(p.id.toString())
    }));

    const total = formattedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

    return { success: true, payments: formattedPayments, total };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- ANALYTICS ACTIONS ---
export async function getProjectAnalytics(projectId: string) {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: "No autorizado" };

  const supabase = await createClient();

  // Validate ownership
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).eq("agency_id", agency.id).single();
  if (!project) return { success: false, error: "No autorizado" };

  // Conversaciones
  const { count: convCount } = await supabase.from("conversations").select("*", { count: 'exact', head: true }).eq("project_id", projectId);
  
  // Mensajes totales (aprox: sumamos de las conversaciones de este proyecto)
  const { data: convIds } = await supabase.from("conversations").select("id").eq("project_id", projectId);
  let msgCount = 0;
  if (convIds && convIds.length > 0) {
    const ids = convIds.map(c => c.id);
    const { count } = await supabase.from("messages").select("*", { count: 'exact', head: true }).in("conversation_id", ids);
    msgCount = count || 0;
  }

  // Turnos
  const { count: aptCount } = await supabase.from("appointments").select("*", { count: 'exact', head: true }).eq("project_id", projectId);
  
  // CatÃƒÂ¡logo (Productos)
  const { count: prodCount } = await supabase.from("products").select("*", { count: 'exact', head: true }).eq("project_id", projectId);

  // Clientes CRM
  const { count: crmCount } = await supabase.from("crm_clients").select("*", { count: 'exact', head: true }).eq("project_id", projectId);

  return { 
    success: true, 
    data: {
      totalConversations: convCount || 0,
      totalMessages: msgCount || 0,
      totalAppointments: aptCount || 0,
      totalProducts: prodCount || 0,
      totalClients: crmCount || 0,
      activeAgents: 1, // Currently 1 AI agent per project
      mpIncome: 0 // Placeholder until webhook syncing
    }
  };
}

// --- AFIP ACTIONS ---
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export async function getInvoices(projectId: string) {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: 'No autorizado' };

  const supabase = await createClient();
  const { data, error } = await supabase.from('invoices').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  
  if (error) return { success: false, error: error.message };
  return { success: true, invoices: data || [] };
}

export async function emitAfipInvoiceInternal(project: any, payment: any, clientCuit: string) {
  const supabase = await createClient();

  // Check if invoice already exists
  const { data: existing } = await supabase.from('invoices').select('id').eq('payment_id', payment.id).single();
  if (existing) return { success: false, error: 'La factura para este pago ya fue emitida' };

  const Afip = (await import('@afipsdk/afip.js')).default;
  const tmpDir = path.join(os.tmpdir(), uuidv4());
  
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'cert'), project.afip_crt);
    await fs.writeFile(path.join(tmpDir, 'key'), project.afip_key);

    const afip = new Afip({
      CUIT: parseInt(project.company_cuit.replace(/[^0-9]/g, ''), 10),
      res_folder: tmpDir,
      production: true
    } as any);

    const isResponsable = project.tax_category === 'responsable_inscripto';
    const cbteTipo = isResponsable ? 1 : 11; // 1 = Factura A (assuming B logic requires checking CUIT logic, but 11 is C)
    // NOTE: In a full app, if isResponsable and client is Consumer, it's Factura B (6). 
    // We will simplify: Monotributo = 11 (C). Resp. Insc = 6 (B) for consumer, 1 (A) for resp.
    const realCbteTipo = project.tax_category === 'monotributo' ? 11 : 6; 

    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(project.afip_pto_vta, realCbteTipo);
    
    const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const data = {
      'CantReg' 	: 1,
      'PtoVta' 	: project.afip_pto_vta,
      'CbteTipo' 	: realCbteTipo, 
      'Concepto' 	: 1,
      'DocTipo' 	: clientCuit ? 80 : 99, // 80 = CUIT, 99 = Consumidor Final anónimo
      'DocNro' 	: clientCuit ? parseInt(clientCuit.replace(/[^0-9]/g, ''), 10) : 0,
      'CbteDesde' 	: lastVoucher + 1,
      'CbteHasta' 	: lastVoucher + 1,
      'CbteFch' 	: parseInt(date.replace(/-/g, '')),
      'ImpTotal' 	: payment.amount,
      'ImpTotConc' 	: 0,
      'ImpNeto' 	: payment.amount,
      'ImpOpEx' 	: 0,
      'ImpTrib' 	: 0,
      'ImpIVA' 	: 0,
      'FchServDesde' 	: null,
      'FchServHasta' 	: null,
      'FchVtoPago' 	: null,
      'MonId' 	: 'PES',
      'MonCotiz' 	: 1
    };

    const res = await afip.ElectronicBilling.createVoucher(data);

    // Save to DB
    await supabase.from('invoices').insert({
      project_id: project.id,
      payment_id: payment.id,
      client_name: payment.client_name || 'Consumidor Final',
      client_cuit: clientCuit || '',
      amount: payment.amount,
      cbte_tipo: realCbteTipo,
      pto_vta: project.afip_pto_vta,
      cbte_nro: lastVoucher + 1,
      cae: res.CAE,
      cae_vto: res.CAEFchVto
    });

    return { success: true, cae: res.CAE, cbte_nro: lastVoucher + 1 };
  } catch (err: any) {
    return { success: false, error: err.message };
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

export async function emitAfipInvoice(projectId: string, payment: any, clientCuit: string) {
  const agency = await getCurrentAgency();
  if (!agency) return { success: false, error: 'No autorizado' };

  const supabase = await createClient();
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).eq('agency_id', agency.id).single();
  
  if (!project || !project.afip_active || !project.afip_crt || !project.afip_key || !project.company_cuit || !project.afip_pto_vta) {
    return { success: false, error: 'AFIP no configurado correctamente' };
  }

  return await emitAfipInvoiceInternal(project, payment, clientCuit);
}



