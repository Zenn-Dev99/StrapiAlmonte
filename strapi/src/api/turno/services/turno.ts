import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::turno.turno', ({ strapi }) => ({
  async enviarMensajeWhatsApp(telefono: string, mensaje: string) {
    // Normalizar teléfono (agregar código de país si no lo tiene)
    let telefonoNormalizado = telefono.replace(/\D/g, '');
    
    // Si no empieza con código de país, asumir Chile (+56)
    if (!telefonoNormalizado.startsWith('56')) {
      telefonoNormalizado = `56${telefonoNormalizado}`;
    }

    // Formato para WhatsApp: 56912345678
    const whatsappNumber = telefonoNormalizado;

    // Aquí implementarías la integración con WhatsApp
    // Opciones: Twilio, WhatsApp Business API, etc.
    // Por ahora, solo logueamos el mensaje
    
    const whatsappApiUrl = process.env.WHATSAPP_API_URL;
    const whatsappApiToken = process.env.WHATSAPP_API_TOKEN;

    if (!whatsappApiUrl || !whatsappApiToken) {
      strapi.log.warn('WhatsApp API no configurada. Mensaje simulado:', {
        to: whatsappNumber,
        message: mensaje,
      });
      return;
    }

    try {
      const response = await fetch(`${whatsappApiUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${whatsappApiToken}`,
        },
        body: JSON.stringify({
          to: whatsappNumber,
          message: mensaje,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
      }

      strapi.log.info(`Mensaje WhatsApp enviado a ${whatsappNumber}`);
    } catch (error) {
      strapi.log.error('Error al enviar mensaje WhatsApp:', error);
      throw error;
    }
  },

  async iniciarConversacionWhatsApp(telefono: string) {
    // Este método se puede usar para iniciar una conversación desde un QR
    const mensajeInicial = '¡Hola! Bienvenido al sistema de turnos. Para obtener tu número de atención, responde con:\n\n- "CAJA" para atención en caja\n- "RETIROS" para retiros';
    
    return this.enviarMensajeWhatsApp(telefono, mensajeInicial);
  },
}));

