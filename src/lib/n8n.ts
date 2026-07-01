// Uso del fetch nativo de Node.js / Next.js

/**
 * Función para interactuar con la API REST de n8n
 * Permite crear Workflows dinámicamente inyectando parámetros del CRM.
 */

interface N8nCredentials {
  baseUrl: string;
  apiKey: string;
}

export async function createN8nWorkflow(
  creds: N8nCredentials,
  projectName: string,
  systemPrompt: string,
  industry: string,
  wahaUrl: string,
  wahaApiKey: string,
  projectId: string,
  capabilities: string[] = [],
  geminiCredId?: string
) {
  // Limpiamos la URL para evitar barras dobles
  const baseUrl = creds.baseUrl.replace(/\/$/, "");
  const webhookPath = `webhook-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  // --- FETCH GOOGLE API CREDENTIAL FROM N8N ---
  let finalGeminiCredId = geminiCredId;
  let finalGeminiCredType = "googlePalmApi";
  if (!finalGeminiCredId) {
    try {
      const credsRes = await fetch(`${baseUrl}/api/v1/credentials`, {
        headers: { "X-N8N-API-KEY": creds.apiKey }
      });
      if (credsRes.ok) {
        const credsData = await credsRes.json();
        const googleCred = credsData.data?.find((c: any) => c.type && c.type.toLowerCase().includes("google"));
        if (googleCred) {
          finalGeminiCredId = googleCred.id;
          finalGeminiCredType = googleCred.type;
        }
      }
    } catch (e) {
      console.error("Error fetching n8n credentials:", e);
    }
  }

  // =========================================================================
  // PLANTILLA JSON DEL WORKFLOW (Estructura Maestra Interfast)
  // =========================================================================
  const workflowTemplate = {
    name: `[${projectId.substring(0,6).toUpperCase()}] Agente: ${projectName}`,
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: webhookPath,
          options: {}
        },
        id: "cbb88c51-f0c8-452e-9ccc-4c0a3537b50e",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [-208, -96],
        webhookId: `interfast-evo-${Date.now()}`
      },
      {
        parameters: {
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: "",
              typeValidation: "strict",
              version: 2
            },
            conditions: [
              {
                id: "e3b866b2-68b7-4f63-9431-71798e263741",
                leftValue: "={{ $json.numero_limpio }}",
                rightValue: "error_extraccion",
                operator: { type: "string", operation: "notEquals" }
              }
            ],
            combinator: "and"
          },
          options: {}
        },
        id: "21e2a40c-acb5-49bc-8f41-12841e4f88c8",
        name: "IF",
        type: "n8n-nodes-base.if",
        typeVersion: 2.2,
        position: [-208, 128]
      },
      {
        parameters: {
          method: "POST",
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/process_incoming_message`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: process.env.SUPABASE_SERVICE_ROLE_KEY || "" },
              { name: "Authorization", value: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}` }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "p_project_id", value: projectId },
              { name: "p_client_phone", value: "={{ $('Code in JavaScript').first().json.numero_limpio }}" },
              { name: "p_client_name", value: "={{ $('Webhook').first().json.body?.payload?.pushName || $('Webhook').first().json.body?.payload?._data?.notifyName || $('Webhook').first().json.body?.payload?.sender?.pushname || 'Cliente' }}" },
              { name: "p_content", value: "={{ $('Webhook').first().json.body?.payload?.body || 'Multimedia' }}" }
            ]
          },
          options: {}
        },
        id: "save-incoming-msg-id-1234",
        name: "Save Incoming Message",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [200, 128]
      },
      {
        parameters: {
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: "",
              typeValidation: "strict",
              version: 2
            },
            conditions: [
              {
                id: "check-bot-paused",
                leftValue: "={{ $json.bot_paused }}",
                rightValue: true,
                operator: { type: "boolean", operation: "notEquals" }
              },
              {
                id: "check-rate-limited",
                leftValue: "={{ $json.rate_limited }}",
                rightValue: true,
                operator: { type: "boolean", operation: "notEquals" }
              },
              {
                id: "check-webhook-token",
                leftValue: "={{ $('Webhook').first().json.query.token }}",
                rightValue: projectId,
                operator: { type: "string", operation: "equals" }
              }
            ],
            combinator: "and"
          },
          options: {}
        },
        id: "check-bot-paused-id-1234",
        name: "Check Bot Paused",
        type: "n8n-nodes-base.if",
        typeVersion: 2.2,
        position: [400, 128]
      },
      {
        parameters: {
          promptType: "define",
          text: "={{ $('Webhook').first().json.body?.payload?.location ? \"Te envié mi ubicación GPS.\" : ($('Webhook').first().json.body?.payload?.body || ($('Analyze audio').isExecuted ? \"El cliente envió un audio y la transcripción literal de su voz es: \" + $('Analyze audio').first().json?.content?.parts?.[0]?.text : null) || \"Te adjunto una imagen o comprobante de pago para que lo analices visualmente según tus reglas.\") }}",
          options: {
            systemMessage: `=${JSON.stringify(systemPrompt + "\n\nREGLA CRÍTICA ANTI-BUCLES: Si detectas que estás hablando con otro Bot automático o contestador (ej: responde cosas como \"Gracias por comunicarte\", \"En breve te atenderemos\", o envía un menú repetitivo), DEBES detener la conversación para evitar un bucle infinito. Responde ÚNICA Y EXACTAMENTE con esta palabra secreta: SILENCIO_BOT\n\nREGLA DE HANDOFF: Si el cliente está muy enojado, insulta, o exige hablar urgentemente con un humano, NO intentes ayudarlo. Responde ÚNICA Y EXACTAMENTE con esta palabra secreta: REQUIERE_HUMANO")} + ($('Save Incoming Message').first().json.vacation_mode ? "\n\nATENCIÓN MODO VACACIONES ACTIVADO: La empresa actualmente se encuentra CERRADA POR VACACIONES. El dueño ha dejado este mensaje para los clientes: \"" + $('Save Incoming Message').first().json.vacation_message + "\". Tu tarea exclusiva es informar amablemente este estado de vacaciones al cliente, responder cualquier pregunta con esta limitación, y pedirle que vuelva a contactar cuando termine el período. NO intentes vender ni agendar turnos ahora." : "")`,
            passthroughBinaryImages: true
          }
        },
        id: "7d1bbc32-fe9a-4b86-8411-94a7cc9fad59",
        name: "AI Agent",
        type: "@n8n/n8n-nodes-langchain.agent",
        typeVersion: 1.7,
        position: [752, 320],
        retryOnFail: true,
        waitBetweenTries: 5000
      },
      {
        parameters: {
          sessionIdType: "customKey",
          sessionKey: "={{ $('Code in JavaScript').first().json.numero_limpio }}",
          contextWindowLength: 20
        },
        id: "894303d8-d4a2-4e8c-94f3-8b9a5cb72881",
        name: "Memory",
        type: "@n8n/n8n-nodes-langchain.memoryBufferWindow",
        typeVersion: 1.3,
        position: [688, 608]
      },
      // Aquí insertaremos dinámicamente las herramientas (Tools) debajo
      {
        parameters: {
          method: "POST",
          url: `${wahaUrl.replace(/\/$/, "")}/api/sendText`,
          sendHeaders: true,
          headerParameters: { parameters: [{ name: "X-Api-Key", value: wahaApiKey }] },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "chatId", value: "={{ $('Code in JavaScript').first().json.numero_limpio }}@c.us" },
              { name: "text", value: "={{ $('AI Agent').first().json.output }}" },
              { name: "session", value: projectId }
            ]
          },
          options: {}
        },
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.4,
        position: [1280, 336],
        id: "6726430b-ca4d-4437-a2d9-210141edc297",
        name: "HTTP Request"
      },
      {
        parameters: {
          method: "POST",
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/messages`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: process.env.SUPABASE_SERVICE_ROLE_KEY || "" },
              { name: "Authorization", value: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}` },
              { name: "Content-Type", value: "application/json" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "conversation_id", value: "={{ $('Save Incoming Message').first().json.conversation_id }}" },
              { name: "role", value: "bot" },
              { name: "content", value: "={{ $('AI Agent').first().json.output }}" }
            ]
          },
          options: {}
        },
        id: "save-outgoing-msg-id-1234",
        name: "Save Outgoing Message",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [1500, 336]
      },
      {
        parameters: {
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: "",
              typeValidation: "strict",
              version: 2
            },
            conditions: [
              {
                id: "anti-loop-condition-uuid",
                leftValue: "={{ $json.output }}",
                rightValue: "SILENCIO_BOT",
                operator: { type: "string", operation: "notEquals" }
              }
            ],
            combinator: "and"
          },
          options: {}
        },
        id: "anti-loop-filter-uuid-1234",
        name: "Anti-Loop Filter",
        type: "n8n-nodes-base.if",
        typeVersion: 2.2,
        position: [1000, 336]
      },
      {
        parameters: {
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: "",
              typeValidation: "strict",
              version: 2
            },
            conditions: [
              {
                id: "sentiment-condition-uuid",
                leftValue: "={{ $json.output }}",
                rightValue: "REQUIERE_HUMANO",
                operator: { type: "string", operation: "equals" }
              }
            ],
            combinator: "and"
          },
          options: {}
        },
        id: "sentiment-switch-uuid-1234",
        name: "Sentiment Switch",
        type: "n8n-nodes-base.if",
        typeVersion: 2.2,
        position: [1150, 336]
      },
      {
        parameters: {
          method: "PATCH",
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/conversations?id=eq.{{ $('Save Incoming Message').first().json.conversation_id }}`,
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: "apikey", value: process.env.SUPABASE_SERVICE_ROLE_KEY || "" },
              { name: "Authorization", value: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}` },
              { name: "Content-Type", value: "application/json" }
            ]
          },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "bot_paused", value: "={{true}}" }
            ]
          },
          options: {}
        },
        id: "pause-bot-supabase-uuid",
        name: "Pause Bot Supabase",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [1350, 150]
      },
      {
        parameters: {
          method: "POST",
          url: `${wahaUrl.replace(/\/$/, "")}/api/sendText`,
          sendHeaders: true,
          headerParameters: { parameters: [{ name: "X-Api-Key", value: wahaApiKey }] },
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: "chatId", value: "={{ $('Code in JavaScript').first().json.numero_limpio }}@c.us" },
              { name: "text", value: "Te pido mil disculpas. He pausado mi sistema automático y he notificado a un asesor humano de nuestro equipo para que lea tu consulta y se comunique contigo a la brevedad." },
              { name: "session", value: projectId }
            ]
          },
          options: {}
        },
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.4,
        position: [1550, 150],
        id: "waha-apology-uuid",
        name: "WAHA Apology"
      },
      {

        parameters: {
          jsCode: "for (const item of $input.all()) {\n  const body = item.json.body || {};\n  const payload = body.payload || {};\n  \n  if (!body.event?.startsWith(\"message\") || payload.fromMe === true || payload.from === \"status@broadcast\") {\n    item.json.numero_limpio = \"error_extraccion\";\n    continue;\n  }\n  let rawNumber = payload._data?.key?.remoteJidAlt || payload.from || \"error_no_number\";\n  item.json.numero_limpio = rawNumber.split('@')[0];\n  item.json.tipo_mensaje = payload.type || \"chat\"; \n  item.json.url_archivo = payload.url || payload.media?.url || payload.message?.imageMessage?.url || payload.message?.audioMessage?.url || null;\n}\nreturn $input.all();"
        },
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [-80, -96],
        id: "77dd8b86-488c-4ed6-b2b0-6a56e83b87c5",
        name: "Code in JavaScript"
      },
      {
        parameters: {
          modelName: "models/gemini-2.5-flash",
          options: {}
        },
        type: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
        typeVersion: 1.1,
        position: [544, 608],
        id: "e957bb5a-da7c-4f4b-92f9-89bc77adc157",
        name: "Google Gemini Chat Model",
        ...(finalGeminiCredId ? { credentials: { [finalGeminiCredType]: { id: finalGeminiCredId, name: "Google Gemini API" } } } : {})
      },
      {
        parameters: {
          resource: "audio",
          operation: "analyze",
          modelId: { __rl: true, value: "models/gemini-2.5-flash", mode: "list", cachedResultName: "models/gemini-2.5-flash" },
          text: "Transcribí este audio a texto de forma literal en español argentino.",
          inputType: "binary",
          options: {}
        },
        type: "@n8n/n8n-nodes-langchain.googleGemini",
        typeVersion: 1.2,
        position: [560, 240],
        id: "35d50f70-70c7-4719-8b55-769aaa41600b",
        name: "Analyze audio",
        ...(finalGeminiCredId ? { credentials: { [finalGeminiCredType]: { id: finalGeminiCredId, name: "Google Gemini API" } } } : {})
      }
    ],
    connections: {
      "Webhook": { main: [[{ node: "Code in JavaScript", type: "main", index: 0 }]] },
      "IF": { main: [[{ node: "Save Incoming Message", type: "main", index: 0 }]] },
      "Save Incoming Message": { main: [[{ node: "Check Bot Paused", type: "main", index: 0 }]] },
      "Check Bot Paused": { main: [[{ node: "AI Agent", type: "main", index: 0 }]] },
      "Code in JavaScript": { main: [[{ node: "IF", type: "main", index: 0 }]] },
      "Google Gemini Chat Model": { ai_languageModel: [[{ node: "AI Agent", type: "ai_languageModel", index: 0 }]] },
      "Memory": { ai_memory: [[{ node: "AI Agent", type: "ai_memory", index: 0 }]] },
      "AI Agent": { main: [[{ node: "Anti-Loop Filter", type: "main", index: 0 }]] },
      "Anti-Loop Filter": { main: [[{ node: "Sentiment Switch", type: "main", index: 0 }]] },
      "Sentiment Switch": { 
        main: [
          [{ node: "Pause Bot Supabase", type: "main", index: 0 }], 
          [{ node: "HTTP Request", type: "main", index: 0 }]
        ] 
      },
      "Pause Bot Supabase": { main: [[{ node: "WAHA Apology", type: "main", index: 0 }]] },
      "HTTP Request": { main: [[{ node: "Save Outgoing Message", type: "main", index: 0 }]] },
      "Analyze audio": { main: [[{ node: "AI Agent", type: "main", index: 0 }]] }
    },
    settings: {}
  };

  if (capabilities.includes("cobros")) {
    workflowTemplate.nodes.push({
      parameters: {
        description: "Generar Pago (Mercado Pago). Recibe: {\\\"product\\\":\\\"Nombre\\\", \\\"price\\\":1000, \\\"phone\\\":\\\"123456789\\\"}. Devuelve el link de pago.",
        jsCode: `const supabaseUrl = '${process.env.NEXT_PUBLIC_SUPABASE_URL}';\nconst supabaseKey = '${process.env.SUPABASE_SERVICE_ROLE_KEY}';\n\ntry {\n  const inputParams = typeof $input.all()[0].json.query === 'string' ? JSON.parse($input.all()[0].json.query) : $input.all()[0].json.query;\n  \n  // Buscar token de MP del proyecto\n  const { data: project } = await this.helpers.httpRequest({\n    method: 'GET',\n    url: \`\${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=mp_access_token\`, \n    headers: {\n      'apikey': supabaseKey,\n      'Authorization': 'Bearer ' + supabaseKey\n    }\n  });\n  \n  const mpToken = project && project[0] && project[0].mp_access_token;\n  if (!mpToken) return "Error: El dueño del bot aún no configuró su cuenta de Mercado Pago.";\n\n  // Crear preferencia en MP\n  const preference = await this.helpers.httpRequest({\n    method: 'POST',\n    url: 'https://api.mercadopago.com/checkout/preferences',\n    headers: {\n      'Authorization': 'Bearer ' + mpToken,\n      'Content-Type': 'application/json'\n    },\n    body: {\n      items: [{ title: inputParams.product, quantity: 1, unit_price: Number(inputParams.price) }],\n      external_reference: inputParams.phone || 'cliente_whatsapp'\n    }\n  });\n  \n  return "Link de pago generado con éxito: " + preference.init_point;\n} catch (error) {\n  return "Error generando pago: " + error.message;\n}`
      },
      type: "@n8n/n8n-nodes-langchain.toolCode",
      typeVersion: 1.3,
      id: "tool-pago",
      name: "Generar Pago",
      position: [700, 600]
    } as any);

    workflowTemplate.nodes.push({
      parameters: {
        description: "Verificar Pago (Mercado Pago). Recibe: {\\\"phone\\\":\\\"123456789\\\"}. Verifica si hay pagos aprobados para ese teléfono.",
        jsCode: `const supabaseUrl = '${process.env.NEXT_PUBLIC_SUPABASE_URL}';\nconst supabaseKey = '${process.env.SUPABASE_SERVICE_ROLE_KEY}';\n\ntry {\n  const inputParams = typeof $input.all()[0].json.query === 'string' ? JSON.parse($input.all()[0].json.query) : $input.all()[0].json.query;\n  \n  const { data: project } = await this.helpers.httpRequest({\n    method: 'GET',\n    url: \`\${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=mp_access_token\`, \n    headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey }\n  });\n  \n  const mpToken = project && project[0] && project[0].mp_access_token;\n  if (!mpToken) return "Error: No hay cuenta de Mercado Pago configurada.";\n\n  const phone = inputParams.phone;\n  if(!phone) return "Error: Se necesita el teléfono del cliente para buscar su pago.";\n\n  const payments = await this.helpers.httpRequest({\n    method: 'GET',\n    url: \`https://api.mercadopago.com/v1/payments/search?external_reference=\${phone}&status=approved&sort=date_created&criteria=desc&limit=5\`,\n    headers: { 'Authorization': 'Bearer ' + mpToken }\n  });\n  \n  if (payments.results && payments.results.length > 0) {\n    return "¡Sí! Se encontró un pago aprobado reciente por $" + payments.results[0].transaction_amount + " de " + payments.results[0].description;\n  } else {\n    return "No se encontraron pagos aprobados para ese teléfono. Dile al cliente que espere unos minutos o revise si el pago no fue rechazado.";\n  }\n} catch (error) {\n  return "Error verificando pago: " + error.message;\n}`
      },
      type: "@n8n/n8n-nodes-langchain.toolCode",
      typeVersion: 1.3,
      id: "tool-verificar-pago",
      name: "Verificar Pago",
      position: [900, 600]
    } as any);

    workflowTemplate.nodes.push({
      parameters: {
        description: "Emitir Factura (ARCA/AFIP). Úsalo cuando el cliente pida factura y ya tenga un pago aprobado. Recibe: {\\\"phone\\\":\\\"123456789\\\", \\\"client_dni\\\":\\\"...\\\"}. El dni es opcional, pideselo primero si no lo tienes.",
        jsCode: `const appUrl = '${process.env.NEXT_PUBLIC_APP_URL || "https://interfast.vercel.app"}';\n\ntry {\n  const inputParams = typeof $input.all()[0].json.query === 'string' ? JSON.parse($input.all()[0].json.query) : $input.all()[0].json.query;\n  \n  const phone = inputParams.phone;\n  if(!phone) return "Error: Se necesita el teléfono del cliente para emitir su factura.";\n\n  const result = await this.helpers.httpRequest({\n    method: 'POST',\n    url: \`\${appUrl}/api/invoices/emit\`,\n    headers: { 'Content-Type': 'application/json' },\n    body: {\n      projectId: '${projectId}',\n      phone: phone,\n      client_dni: inputParams.client_dni || ''\n    }\n  });\n  \n  if (result.success) {\n    return result.message;\n  } else {\n    return "No se pudo emitir la factura: " + result.error;\n  }\n} catch (error) {\n  return "Error emitiendo factura: " + error.message;\n}`
      },
      type: "@n8n/n8n-nodes-langchain.toolCode",
      typeVersion: 1.3,
      id: "tool-emitir-factura",
      name: "Emitir Factura",
      position: [1100, 600]
    } as any);

    (workflowTemplate.connections as any)["Gestor de Turnos"] = (workflowTemplate.connections as any)["Gestor de Turnos"] || { main: [[]] };
  }

  // --- INYECCIÓN DINÁMICA DE HERRAMIENTAS (LEGO) ---
  const aiAgentConnections: any[] = [];
  
  if (capabilities.includes("cobros")) {
    aiAgentConnections.push({ node: "Generar Pago", type: "ai_tool", index: 0 });
    aiAgentConnections.push({ node: "Verificar Pago", type: "ai_tool", index: 0 });
    aiAgentConnections.push({ node: "Emitir Factura", type: "ai_tool", index: 0 });
  }

  if (capabilities.includes("ventas")) {
    workflowTemplate.nodes.push({
      parameters: {
        description: "Busca productos en el catálogo. Devuelve precios y stock disponible.",
        jsCode: `const supabaseUrl = '${process.env.NEXT_PUBLIC_SUPABASE_URL}';\nconst supabaseKey = '${process.env.SUPABASE_SERVICE_ROLE_KEY}';\ntry {\n  const data = await this.helpers.httpRequest({\n    method: 'GET',\n    url: \`\${supabaseUrl}/rest/v1/products?project_id=eq.${projectId}\`,\n    headers: {\n      'apikey': supabaseKey,\n      'Authorization': 'Bearer ' + supabaseKey\n    }\n  });\n  return JSON.stringify(data);\n} catch (error) {\n  return "Error accediendo al catálogo: " + error.message;\n}`
      },
      type: "@n8n/n8n-nodes-langchain.toolCode",
      typeVersion: 1.3,
      position: [992, 608],
      id: "tool-ventas-" + Date.now(),
      name: "Catálogo y Stock"
    } as any);
    aiAgentConnections.push({ node: "Catálogo y Stock", type: "ai_tool", index: 0 });
  }

  if (capabilities.includes("turnos")) {
    workflowTemplate.nodes.push({
      parameters: {
        description: "Gestor de Turnos. Para ver turnos ocupados envía {\\\"action\\\":\\\"check\\\", \\\"date\\\":\\\"YYYY-MM-DD\\\"}. Para reservar envía {\\\"action\\\":\\\"book\\\", \\\"date\\\":\\\"YYYY-MM-DD\\\", \\\"time\\\":\\\"HH:MM\\\", \\\"client_name\\\":\\\"...\\\", \\\"client_dni\\\":\\\"...\\\", \\\"health_insurance\\\":\\\"...\\\", \\\"service\\\":\\\"...\\\"}.",
        jsCode: `const supabaseUrl = '${process.env.NEXT_PUBLIC_SUPABASE_URL}';\nconst supabaseKey = '${process.env.SUPABASE_SERVICE_ROLE_KEY}';\n\ntry {\n  const inputParams = typeof $input.all()[0].json.query === 'string' ? JSON.parse($input.all()[0].json.query) : $input.all()[0].json.query;\n  \n  if (inputParams.action === 'check') {\n    const data = await this.helpers.httpRequest({\n      method: 'GET',\n      url: \`\${supabaseUrl}/rest/v1/appointments?project_id=eq.${projectId}&date=eq.\${inputParams.date}&select=time\`, \n      headers: {\n        'apikey': supabaseKey,\n        'Authorization': 'Bearer ' + supabaseKey\n      }\n    });\n    return "Turnos ocupados para " + inputParams.date + ": " + JSON.stringify(data);\n  }\n  \n  if (inputParams.action === 'book') {\n    const data = await this.helpers.httpRequest({\n      method: 'POST',\n      url: \`\${supabaseUrl}/rest/v1/appointments\`,\n      headers: {\n        'apikey': supabaseKey,\n        'Authorization': 'Bearer ' + supabaseKey,\n        'Content-Type': 'application/json',\n        'Prefer': 'return=representation'\n      },\n      body: {\n        project_id: '${projectId}',\n        client_name: inputParams.client_name,\n        client_dni: inputParams.client_dni,\n        health_insurance: inputParams.health_insurance,\n        date: inputParams.date,\n        time: inputParams.time,\n        service: inputParams.service,\n        status: 'confirmado'\n      }\n    });\n    return "¡Turno agendado exitosamente! Detalles: " + JSON.stringify(data[0]);\n  }\n  \n  return "Acción no reconocida. Usa 'check' o 'book'.";\n} catch (error) {\n  return "Error en el gestor de turnos: " + error.message;\n}`
      },
      type: "@n8n/n8n-nodes-langchain.toolCode",
      typeVersion: 1.3,
      position: [1184, 608],
      id: "tool-turnos-" + Date.now(),
      name: "Gestor de Turnos"
    } as any);
    aiAgentConnections.push({ node: "Gestor de Turnos", type: "ai_tool", index: 0 });
  }

  if (capabilities.includes("soporte")) {
    workflowTemplate.nodes.push({
      parameters: {
        description: "Crea un ticket de soporte técnico para que un humano lo revise.",
        jsCode: `const supabaseUrl = '${process.env.NEXT_PUBLIC_SUPABASE_URL}';\nconst supabaseKey = '${process.env.SUPABASE_SERVICE_ROLE_KEY}';\nconst wahaUrl = '${wahaUrl}';\nconst wahaApiKey = '${wahaApiKey}';\n\ntry {\n  const { data: project } = await this.helpers.httpRequest({\n    method: 'GET',\n    url: \`\${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=owner_phone,company_name\`,\n    headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey }\n  });\n  \n  if (project && project[0] && project[0].owner_phone) {\n    const ownerPhone = project[0].owner_phone;\n    const clientPhone = typeof $input.all()[0].json.numero_limpio !== 'undefined' ? $input.all()[0].json.numero_limpio : 'Desconocido';\n    \n    await this.helpers.httpRequest({\n      method: 'POST',\n      url: \`\${wahaUrl.replace(/\\/$/, "")}/api/sendText\`,\n      headers: {\n        'Content-Type': 'application/json',\n        'X-Api-Key': wahaApiKey\n      },\n      body: {\n        chatId: ownerPhone + '@c.us',\n        text: '🚨 *ALERTA DE SOPORTE*\\n\\nEl cliente con número +' + clientPhone + ' necesita atención humana urgente en la bandeja de chat.\\nProyecto: ' + (project[0].company_name || 'Desconocido'),\n        session: '${projectId}'\n      }\n    });\n  }\n  return 'Ticket de soporte creado. Un agente humano se contactará contigo a la brevedad.';\n} catch (e) {\n  console.log(e);\n  return 'Ticket de soporte creado.';\n}`
      },
      type: "@n8n/n8n-nodes-langchain.toolCode",
      typeVersion: 1.3,
      position: [1376, 608],
      id: "tool-soporte-" + Date.now(),
      name: "Crear Ticket Soporte"
    } as any);
    aiAgentConnections.push({ node: "Crear Ticket Soporte", type: "ai_tool", index: 0 });
  }

  if (capabilities.includes("documentos")) {
    workflowTemplate.nodes.push({
      parameters: {
        description: "Envía Documentos o Comprobantes (Presupuestos, Facturas, Turnos o Reservas) al cliente por WhatsApp o Email. Pide el email primero si elige esa vía. Recibe un JSON: {\\\"type\\\": \\\"presupuesto\\\" | \\\"turno\\\" | \\\"factura\\\" | \\\"reserva\\\", \\\"channel\\\": \\\"whatsapp\\\" | \\\"email\\\", \\\"clientEmail\\\": \\\"...\\\", \\\"data\\\": { \\\"items\\\": [{\\\"description\\\": \\\"...\\\", \\\"quantity\\\": 1, \\\"price\\\": 100}], \\\"total\\\": 100, \\\"clientName\\\": \\\"...\\\", \\\"date\\\": \\\"...\\\", \\\"details\\\": \\\"...\\\" } }",
        jsCode: `const appUrl = '${process.env.NEXT_PUBLIC_APP_URL || "https://interfast.vercel.app"}';\n\ntry {\n  const inputParams = typeof $input.all()[0].json.query === 'string' ? JSON.parse($input.all()[0].json.query) : $input.all()[0].json.query;\n  \n  const clientPhone = typeof $input.all()[0].json.numero_limpio !== 'undefined' ? $input.all()[0].json.numero_limpio : '';\n  \n  const result = await this.helpers.httpRequest({\n    method: 'POST',\n    url: \`\${appUrl}/api/documents/send\`,\n    headers: { 'Content-Type': 'application/json' },\n    body: {\n      projectId: '${projectId}',\n      type: inputParams.type,\n      channel: inputParams.channel,\n      clientPhone: clientPhone,\n      clientEmail: inputParams.clientEmail,\n      data: inputParams.data\n    }\n  });\n  \n  if (result.success) {\n    return "Documento enviado exitosamente por " + inputParams.channel + " al cliente.";\n  } else {\n    return "No se pudo enviar el documento: " + result.error;\n  }\n} catch (error) {\n  return "Error enviando documento: " + error.message;\n}`
      },
      type: "@n8n/n8n-nodes-langchain.toolCode",
      typeVersion: 1.3,
      position: [1568, 608],
      id: "tool-documentos-" + Date.now(),
      name: "Enviar Documento"
    } as any);
    aiAgentConnections.push({ node: "Enviar Documento", type: "ai_tool", index: 0 });
  }

  // Conectar dinámicamente todas las herramientas inyectadas al AI Agent
  if (aiAgentConnections.length > 0) {
    aiAgentConnections.forEach(conn => {
      workflowTemplate.connections[conn.node as keyof typeof workflowTemplate.connections] = {
        ai_tool: [[{ node: "AI Agent", type: "ai_tool", index: 0 }]]
      } as any;
    });
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/workflows`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": creds.apiKey
      },
      body: JSON.stringify(workflowTemplate)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Error en API n8n (${response.status}): ${errorData}`);
    }

    const data = await response.json();

    // Activate workflow
    await fetch(`${baseUrl}/api/v1/workflows/${data.id}/activate`, {
      method: "POST",
      headers: { "X-N8N-API-KEY": creds.apiKey }
    }).catch(e => console.error("Error activating workflow:", e));

    return {
      success: true,
      workflowId: data.id,
      webhookUrl: `${baseUrl}/webhook/${webhookPath}?token=${projectId}`
    };
  } catch (error: any) {
    console.error("n8n creation failed:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteN8nWorkflowByPrefix(creds: N8nCredentials, prefix: string) {
  const baseUrl = creds.baseUrl.replace(/\/$/, "");
    try {
      let allWorkflows: any[] = [];
      let nextCursor = null;
      let url = `${baseUrl}/api/v1/workflows?limit=1000`;
      
      while (true) {
        const res: any = await fetch(nextCursor ? `${url}&cursor=${nextCursor}` : url, {
          method: "GET",
          headers: { "X-N8N-API-KEY": creds.apiKey }
        });
        
        if (!res.ok) break;
        
        const data = await res.json();
        if (data.data) allWorkflows = [...allWorkflows, ...data.data];
        
        if (data.nextCursor) {
          nextCursor = data.nextCursor;
        } else {
          break;
        }
      }
      
      const workflows = allWorkflows;
    
    // Buscar todos los workflows cuyo nombre empiece con la etiqueta generada, ej: "[A1B2C3]"
    const toDelete = workflows.filter((w: any) => w.name && w.name.includes(prefix));

    for (const w of toDelete) {
      if (w.active) {
        await fetch(`${baseUrl}/api/v1/workflows/${w.id}/deactivate`, {
          method: "POST",
          headers: { "X-N8N-API-KEY": creds.apiKey }
        }).catch(() => {});
        await fetch(`${baseUrl}/api/v1/workflows/${w.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-N8N-API-KEY": creds.apiKey },
          body: JSON.stringify({ active: false })
        }).catch(() => {});
      }
      await fetch(`${baseUrl}/api/v1/workflows/${w.id}`, {
        method: "DELETE",
        headers: { "X-N8N-API-KEY": creds.apiKey }
      });
    }

    return { success: true, count: toDelete.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
