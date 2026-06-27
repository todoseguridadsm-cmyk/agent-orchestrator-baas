/**
 * Servicio para interactuar con la API REST de n8n.
 * Documentación oficial: https://docs.n8n.io/api/
 */

interface N8nCredentials {
  baseUrl: string; // Ej: https://tu-instancia.n8n.cloud
  apiKey: string;  // Generada dentro de n8n (Settings > n8n API)
}

/**
 * Crea un nuevo Workflow en n8n dinámicamente inyectando el prompt y datos del cliente.
 */
export async function createN8nWorkflow(
  creds: N8nCredentials, 
  projectName: string, 
  systemPrompt: string, 
  templateJson: any // El JSON exportado de un workflow base de n8n
) {
  try {
    // 1. Modificar la plantilla en memoria para inyectar los datos de este cliente
    // (Por ejemplo, cambiar un nodo HTTP Request o un nodo de Gemini para que use el systemPrompt)
    const customizedWorkflow = {
      ...templateJson,
      name: `AgentFlow: ${projectName}`,
      active: true, // Queremos que nazca encendido
    };

    // 2. Hacer la llamada POST a la API de n8n para crear el workflow real
    const response = await fetch(`${creds.baseUrl}/api/v1/workflows`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": creds.apiKey,
      },
      body: JSON.stringify(customizedWorkflow),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error en n8n API: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data; // Retorna los datos del nuevo workflow (incluyendo su ID)
  } catch (error) {
    console.error("Error creando el agente en n8n:", error);
    throw error;
  }
}

/**
 * Desactiva o activa un workflow existente (Handoff a humano).
 */
export async function toggleN8nWorkflow(creds: N8nCredentials, workflowId: string, active: boolean) {
  const response = await fetch(`${creds.baseUrl}/api/v1/workflows/${workflowId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": creds.apiKey,
    },
    body: JSON.stringify({ active }),
  });
  return response.json();
}
