# Ticket Flow Scanner — App

App de Android para validar boletos en la puerta de un evento, funciona
completamente sin internet una vez que descargas los boletos.

## 1. Preparar tu computadora (una sola vez)

```bash
# Necesitas Node.js instalado (https://nodejs.org, versión LTS)
npm install -g eas-cli
```

Crea una cuenta gratis en https://expo.dev si no tienes una — la vas a
necesitar para compilar el `.apk`.

## 2. Instalar el proyecto

Copia estos archivos a una carpeta en tu computadora, entra a esa
carpeta en la terminal, y corre:

```bash
npm install
npx expo install expo-camera expo-sqlite expo-status-bar
```

(El segundo comando asegura que cada paquete quede en la versión exacta
que espera tu versión de Expo — a veces `npm install` solo no alcanza.)

## 3. Iniciar sesión en Expo

```bash
eas login
```

## 4. Compilar el .apk

```bash
eas build --platform android --profile preview
```

Esto compila en los servidores de Expo (gratis, tarda entre 10-20
minutos) y al final te da un link para descargar el `.apk` directo a tu
computadora o celular.

**Importante:** la primera vez que corras esto, Expo te va a preguntar
si quiere generar las credenciales de Android automáticamente — dile
que sí, no hace falta que sepas nada de eso.

## 5. Instalar el .apk en el celular

Pasa el archivo `.apk` al teléfono (por USB, WhatsApp, Google Drive, lo
que sea) y ábrelo — Android va a pedir permiso para "instalar apps de
fuentes desconocidas" la primera vez, es normal, actívalo solo para
este archivo.

## Sobre probar la app antes de compilar

**"Expo Go"** (la app de preview rápida de Expo) **no sirve para probar
el escáner** — el escaneo de QR necesita una compilación real (development
build o el mismo `.apk` de arriba), porque usa una función de cámara que
Expo Go no incluye. Para probar cambios rápido sin compilar cada vez,
usa:

```bash
eas build --platform android --profile preview --local
```

O simplemente compila con el comando del paso 4 cada vez que quieras
probar en el teléfono real.

## Cómo funciona el modo offline, en resumen

1. Con internet: entras con el código de puerta, tocas "Descargar
   boletos para offline" — se guardan todos en el teléfono.
2. Sin internet: escaneas normal, todo se valida contra lo que ya está
   guardado en el teléfono — no necesita señal para nada de esto.
3. Cuando vuelve la señal: la app sube sola, en segundo plano, todo lo
   que se validó mientras no había internet.

## Si quieres cambiar algo del diseño o los colores

Los archivos de pantallas están en `src/screens/` — `LoginScreen.js` y
`ScannerScreen.js`. Los estilos están al final de cada archivo, en el
bloque `StyleSheet.create({...})`.
