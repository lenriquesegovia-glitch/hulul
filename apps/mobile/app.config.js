/**
 * Configuración de la app = app.json + lo que depende de archivos locales.
 * Las notificaciones en Android necesitan google-services.json (se descarga de
 * Firebase → Configuración del proyecto → Tus apps → Android com.hulul.app).
 * Si el archivo no está, la app se arma igual, pero sin notificaciones.
 */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  // Notificaciones con sonido (canal "pedidos"). Va aquí y no en app.json para no
  // chocar con los ajustes locales de Expo que guarda actualizar.bat.
  config.plugins = [
    ...(config.plugins ?? []),
    ['expo-notifications', { color: '#7A1E2C', defaultChannel: 'pedidos' }],
    // Fotos del problema (cliente) y del trabajo: cámara y galería.
    ['expo-image-picker', {
      cameraPermission: 'HULUL usa la cámara para que tomes fotos del problema o del trabajo terminado.',
      photosPermission: 'HULUL usa tus fotos para adjuntarlas a tu reserva.',
    }],
  ];
  const google = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(google)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
    // "Continuar con Google": usa el cliente web (client_type 3) del mismo archivo.
    try {
      const gs = JSON.parse(fs.readFileSync(google, 'utf8'));
      const web = (gs.client ?? []).flatMap((c) => c.oauth_client ?? []).find((o) => o.client_type === 3);
      if (web?.client_id) {
        config.extra = { ...config.extra, googleWebClientId: web.client_id };
        config.plugins = [...config.plugins, '@react-native-google-signin/google-signin'];
      }
    } catch { /* archivo inválido: se arma sin Google */ }
  }
  return config;
};
