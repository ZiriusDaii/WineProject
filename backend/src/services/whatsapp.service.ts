const API_VERSION = "v18.0";
const BASE_URL = "https://graph.facebook.com";

interface MetaMessageResponse {
  messages?: Array<{ id?: string }>;
}

function getApiUrl(): string {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID no esta configurado");
  }
  return `${BASE_URL}/${API_VERSION}/${phoneNumberId}/messages`;
}

function getAuthHeader(): Record<string, string> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) {
    throw new Error("WHATSAPP_TOKEN no esta configurado");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function sendMessage(to: string, messageText: string): Promise<void> {
  try {
    const url = getApiUrl();

    const body = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: messageText },
    };

    console.log(`[WhatsApp] Enviando mensaje de texto a ${to}: "${messageText.slice(0, 50)}..."`);

    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as MetaMessageResponse;

    if (!response.ok) {
      console.error(`[WhatsApp] Error al enviar mensaje a ${to}:`, JSON.stringify(data, null, 2));
      throw new Error(`Meta API error: ${response.status} - ${JSON.stringify(data)}`);
    }

    console.log(`[WhatsApp] Mensaje enviado exitosamente a ${to}. Message ID: ${data.messages?.[0]?.id || "N/A"}`);
  } catch (error) {
    console.error(`[WhatsApp] Fallo al enviar mensaje a ${to}:`, error);
    throw error;
  }
}

export async function sendInteractiveMessage(
  to: string,
  headerText: string,
  bodyText: string,
  buttonText: string,
  url: string,
): Promise<void> {
  try {
    const apiUrl = getApiUrl();

    const body = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "cta_url",
        header: { type: "text", text: headerText },
        body: { text: bodyText },
        footer: { text: "WineSpa - Agendamiento Premium" },
        action: {
          name: "cta_url",
          parameters: {
            display_text: buttonText,
            url,
          },
        },
      },
    };

    console.log(`[WhatsApp] Enviando mensaje interactivo a ${to} con URL: ${url}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as MetaMessageResponse;

    if (!response.ok) {
      console.error(`[WhatsApp] Error al enviar mensaje interactivo a ${to}:`, JSON.stringify(data, null, 2));
      throw new Error(`Meta API error: ${response.status} - ${JSON.stringify(data)}`);
    }

    console.log(`[WhatsApp] Mensaje interactivo enviado exitosamente a ${to}. Message ID: ${data.messages?.[0]?.id || "N/A"}`);
  } catch (error) {
    console.error(`[WhatsApp] Fallo al enviar mensaje interactivo a ${to}:`, error);
    throw error;
  }
}
