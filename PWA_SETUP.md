# PWA Setup Instructions

## What's Next? - Progressive Web App

Your app is now configured as a Progressive Web App (PWA)! Users can install it on their phones and use it like a native app.

## 📱 Features Implemented

- ✅ **Installable**: Users can add the app to their home screen
- ✅ **Offline Support**: Service worker caches essential files
- ✅ **App-like Experience**: Runs in standalone mode without browser UI
- ✅ **Install Prompt**: Smart banner prompts users to install
- ✅ **iOS Support**: Apple-specific meta tags for iOS devices

## 🎨 Generating App Icons

You need to create PNG icons for the app. Here's how:

### Option 1: Use the Icon Generator (Quick)
1. Open `public/generate-icons.html` in your browser
2. It will automatically download `icon-192.png` and `icon-512.png`
3. Move these files to the `public` folder

### Option 2: Create Custom Icons (Recommended)
1. Design your icon (512x512px recommended)
2. Use an online tool like:
   - https://realfavicongenerator.net/
   - https://www.pwabuilder.com/imageGenerator
3. Generate 192x192 and 512x512 PNG versions
4. Save them as `icon-192.png` and `icon-512.png` in the `public` folder

### Option 3: Convert the SVG
1. Use the provided `public/icon.svg` as a base
2. Convert it to PNG using:
   - Online: https://cloudconvert.com/svg-to-png
   - Command line: `npm install -g svg2png-cli && svg2png icon.svg icon-512.png --width 512 --height 512`

## 🚀 Testing the PWA

### On Desktop (Chrome/Edge)
1. Run `npm run dev`
2. Open the app in Chrome
3. Look for the install icon in the address bar
4. Click to install

### On Android
1. Deploy your app to a server with HTTPS
2. Open in Chrome on Android
3. Tap the "Add to Home Screen" prompt
4. Or use the menu: ⋮ → "Install app"

### On iOS (iPhone/iPad)
1. Deploy your app to a server with HTTPS
2. Open in Safari
3. Tap the Share button
4. Scroll down and tap "Add to Home Screen"

## 📝 Important Notes

- **HTTPS Required**: PWAs require HTTPS in production (localhost works for development)
- **Service Worker**: Updates automatically when you deploy new versions
- **Cache Management**: The service worker caches files for offline use
- **Install Prompt**: Shows once per week if dismissed

## 🔧 Customization

### Update App Name
Edit `public/manifest.json`:
```json
{
  "name": "Your App Name",
  "short_name": "Short Name"
}
```

### Change Theme Color
Edit `public/manifest.json` and `index.html`:
```json
{
  "theme_color": "#your-color",
  "background_color": "#your-color"
}
```

### Modify Cache Strategy
Edit `public/sw.js` to change what gets cached and how.

## 📦 Deployment

When deploying, ensure:
1. Icons are in the `public` folder
2. `manifest.json` is accessible at `/manifest.json`
3. `sw.js` is accessible at `/sw.js`
4. Your site uses HTTPS

## 🐛 Troubleshooting

### Install button doesn't appear
- Check browser console for errors
- Ensure you're using HTTPS (or localhost)
- Try clearing cache and reloading

### Service worker not registering
- Check `sw.js` is accessible at `/sw.js`
- Look for errors in DevTools → Application → Service Workers
- Try unregistering old service workers

### Icons not showing
- Ensure PNG files exist in `public` folder
- Check file names match manifest.json
- Clear browser cache

## 📚 Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
