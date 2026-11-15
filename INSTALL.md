# Install YouTube Focus Board

The extension is plain files. No JDK, Gradle, Node.js, or Android Studio is needed. YouTube must be reachable for videos to play; the extension sends no data to an external service and stores its board, notes, switches, unlock timer, and time locally in the browser.

## Chrome on a laptop

1. Copy or download the `YouTube Focus Board` folder and extract it if it is zipped.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the `YouTube Focus Board` folder containing `manifest.json`.
5. Open `https://www.youtube.com`, open the Extensions menu, and pin **YouTube Focus Board** if you want quick access.
6. Open a video, open the extension, and select **Add current** to save it to your study list. Use **Save note here** while the video is at the moment you want to remember. Select **Jump** beside a saved note to seek back to that timestamp.
7. Set the Shorts, Recommendations, and Comments switches in the extension. On a locked YouTube page, enter a reason to unlock YouTube for 60 minutes.

Chrome's developer mode is a built-in browser setting used to load this local, unpublished extension. No development software or build step is required. The extension asks to run on YouTube pages because it must adjust that page.

## Android phone

Chrome for Android does not install desktop Chrome extensions. Use Vivaldi for Android if you want to run this same Chrome extension on the phone. Vivaldi's Android extension guide documents loading an unpacked extension folder; its Desktop Site option must be on for extension installation. Transfer this folder to the phone, then in Vivaldi open **Extensions > Manage Extensions**, turn on **Developer Mode**, choose **Load unpacked**, and select the folder containing `manifest.json`. Open YouTube in Vivaldi, then use the extension menu. The extension UI and YouTube layout may be tighter on a phone.

YouTube video playback needs an internet connection. The extension itself uses no paid API or account. Settings and study data do not sync to the laptop or another browser; each browser stores its own copy.
