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
  config.plugins = [...(config.plugins ?? []), ['expo-notifications', { color: '#7A1E2C', defaultChannel: 'pedidos' }]];
  const google = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(google)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
