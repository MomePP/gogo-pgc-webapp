# GoGo Programming Continuum Web Application

A visual programming interface built with Nuxt.js and Blockly that enables remote control and programming of GoGo devices through MQTT communication.

## Features

- **Visual Block Programming**: Drag-and-drop interface using Google Blockly
- **Real-time MQTT Integration**: Bidirectional communication with GoGo devices
- **Live Command Capture**: Convert remote commands into visual blocks automatically
- **Multi-channel Support**: Connect to different device channels
- **Responsive Design**: Collapsible sidebar and mobile-friendly interface
- **Code Generation**: Convert visual blocks to executable commands

## Architecture

### Core Components

- **BlocklyEditor.vue**: Main visual programming interface with custom blocks for movement and timing
- **SettingsPanel.vue**: MQTT connection settings and message monitoring
- **Custom Blockly Blocks**: Specialized blocks for GoGo device commands (movement, timing, control)

### MQTT Topics

- **Remote Topic**: `gogo-pgc/remote/<channel>` - Receives commands from devices
- **Blockly Topic**: `gogo-pgc/blockly/<channel>` - Sends generated code to devices  
- **Control Topic**: `gogo-pgc/control/<channel>` - Sends control commands (run/stop)

## Setup

### Prerequisites

- Node.js 18+ 
- npm, pnpm, yarn, or bun

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd gogo-pgc-webapp

# Install dependencies
npm install
# or
pnpm install
# or
yarn install
# or
bun install
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
# MQTT Configuration
MQTT_BROKER_URL=wss://broker.emqx.io:8084/mqtt
MQTT_REMOTE_TOPIC=gogo-pgc/remote/
MQTT_BLOCKLY_TOPIC=gogo-pgc/blockly/
MQTT_CONTROL_TOPIC=gogo-pgc/control/
```

## Development

Start the development server:

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
# or
bun run dev
```

The application will be available at `http://localhost:3000`

## Usage

### Getting Started

1. **Connect to a Channel**:
   - Open the settings panel (left sidebar)
   - Enter a channel name (e.g., "robot1")
   - Click "Connect" to subscribe to MQTT topics

2. **Visual Programming**:
   - Drag blocks from the toolbox to create programs
   - Connect movement blocks (forward, backward, left, right)
   - Add timing blocks for delays
   - All programs must start with the "Start" block

3. **Remote Command Capture**:
   - Send commands to the remote topic to see them appear as blocks
   - Commands are automatically converted to visual blocks
   - Supported commands: F (forward), B (backward), L (left), R (right), S (stop)

4. **Deploy Programs**:
   - Click "Download" to send your visual program to the device
   - Click the play button to execute the program on the device

### Block Types

- **Movement Blocks**: Forward, backward, left, right, stop
- **Timing Blocks**: Wait/delay functionality  
- **Control Blocks**: Start block (required for all programs)

### Command Protocol

Commands are sent as single character strings:
- `F` - Move forward
- `B` - Move backward  
- `L` - Turn left
- `R` - Turn right
- `S` - Stop

## Production Build

Build the application for production:

```bash
npm run build
# or
pnpm build
# or
yarn build
# or
bun run build
```

Preview the production build locally:

```bash
npm run preview
# or
pnpm preview
# or
yarn preview
# or
bun run preview
```

## GitHub Pages Deployment

This application is configured for GitHub Pages deployment with a static preset.

### Automatic Deployment

```bash
# Build for GitHub Pages
npm run build-gh-pages

# Deploy to GitHub Pages
npm run deploy-gh-pages
```

### Manual Deployment

1. Build the application: `npm run build`
2. The static files will be in `.output/public/`
3. Deploy these files to your GitHub Pages repository

## Configuration

### MQTT Settings

The application connects to `broker.emqx.io` by default. You can modify the broker URL and topics through environment variables.

### Base URL

For GitHub Pages deployment, the base URL is set to `/gogo-pgc-webapp`. Update this in `nuxt.config.ts` if deploying to a different path.

### Custom Blockly Blocks

Custom blocks are defined in:
- `blockly/blocks/gogo-block.js` - Block definitions
- `blockly/generators/gogo-generator.js` - Code generation
- `blockly/gogo-toolbox.xml` - Toolbox configuration

## Troubleshooting

### MQTT Connection Issues

- Verify the broker URL is accessible
- Check that the channel name doesn't contain special characters
- Ensure WebSocket connections are allowed in your network

### Blockly Not Loading

- Clear browser cache and reload
- Check browser console for JavaScript errors
- Verify all Blockly dependencies are installed

### GitHub Pages Deployment

- Ensure the repository has GitHub Pages enabled
- Check that the base URL matches your repository name
- Verify all static assets are properly referenced

## Development Guidelines

### Adding New Blocks

1. Define the block in `blockly/blocks/gogo-block.js`
2. Add code generation in `blockly/generators/gogo-generator.js`
3. Update the toolbox in `blockly/gogo-toolbox.xml`
4. Add styling in the Blockly theme configuration

### MQTT Message Handling

- All MQTT logic is centralized in the components
- Message parsing happens in `resolveCommandPacket()`
- Block creation from commands is handled in `createBlockFromCommand()`

