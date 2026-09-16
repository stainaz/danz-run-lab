# DANZ Run Lab

DANZ Run Lab is a lightweight running pace planner and progress tracker. Choose a distance and target finish time to generate a precise target pace, speed, and kilometre-by-kilometre split plan.

![DANZ Run Lab progress dashboard](progress.png)

## Features

- Preset 5K, 10K, and half-marathon distances
- Custom distances from 0.4 km to 100 km
- Live pace, speed, finish-time, and split calculations
- Editable and reusable saved sessions
- Actual results compared with target times
- Pace history and personal-best tracking
- Shareable pace-plan links
- CSV export and JSON backup/restore
- Installable offline web app
- Responsive desktop and mobile design

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static file server:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Install

Open the live site in a supported browser and choose **Install app**. Once installed, the core app works offline.

## Privacy

Session data is stored only in the browser's local storage. Nothing leaves the device unless you export a file or share a pace-plan link.

## Technology

The app is dependency-free and built with HTML, CSS, and vanilla JavaScript.
