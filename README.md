# DJ Friend - Audio Player

This project is a web-based audio player designed for a DJ to showcase their demo tracks. The application is built with Next.js and TypeScript, using Tailwind CSS for styling.

### Key Features:
- **Dynamic Tracklist:** The player loads a list of songs from a `public/demos.json` file. The audio files are located in `public/audio/demos/`.
- **Audio Playback:** A persistent audio player bar appears at the bottom of the screen when a track is selected.
- **Player Controls:** The player includes standard controls: Play/Pause, Skip, a seekable progress bar, and volume controls.
- **Waveform Visualization:** It uses `wavesurfer.js` to render a visual waveform of the currently playing audio.
- **Track Information:** Each track is displayed in a card with its name and the date it was added. The card also contains links to download the track and listen on Spotify.

### Technical Stack:
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v3
- **Key Libraries:**
    - `wavesurfer.js` for audio visualization.
    - `react-window` for efficiently rendering the list of tracks.
    - `lucide-react` for icons.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
