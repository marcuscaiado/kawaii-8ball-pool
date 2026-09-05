import { Peer } from 'peerjs';

const ROOM_PREFIX = 'kawaii-8pool-v2-';

export class PoolNetwork {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.roomCode = null;
    this.isHost = false;
    this.playerNumber = 1; // 1 = Host (Cherry), 2 = Guest (Berry)
    this.connectedPeerId = null;

    // Callbacks
    this.onPeerJoin = null;         // (peerId, isHost) => void
    this.onPeerLeave = null;        // (peerId) => void
    this.onOpponentAim = null;      // ({ angle, power, active }) => void
    this.onOpponentShot = null;     // ({ angle, power, cueBallX, cueBallY }) => void
    this.onStateSync = null;        // ({ balls, currentPlayer, playerTypes }) => void
    this.onEmote = null;            // ({ emote, playerNumber }) => void
    this.onRematch = null;          // ({ playerNumber }) => void

    this._lastAimTime = 0;
    this._onStorage = null;
    this._pollTimer = null;
    this._lastSeenTs = 0;
  }

  initRoom(roomCode, isHost = false) {
    this.leaveRoom();
    this.roomCode = roomCode.toUpperCase().trim();
    this.isHost = isHost;
    this.playerNumber = isHost ? 1 : 2;

    const fullPeerId = ROOM_PREFIX + this.roomCode;

    // 1. Cross-Tab Local Bus (works instantly on same browser/machine)
    if (typeof window !== 'undefined') {
      this._onStorage = (e) => {
        if (e.key !== `kawaii_bus_${this.roomCode}`) return;
        if (!e.newValue) return;
        try {
          const { type, data, sender, ts } = JSON.parse(e.newValue);
          if (sender === this.playerNumber) return;
          if (ts) this._lastSeenTs = ts;
          this._handleMessage(type, data);
        } catch (_) {}
      };
      window.addEventListener('storage', this._onStorage);

      this._pollTimer = setInterval(() => {
        try {
          const raw = localStorage.getItem(`kawaii_bus_${this.roomCode}`);
          if (!raw) return;
          const { type, data, sender, ts } = JSON.parse(raw);
          if (ts && ts !== this._lastSeenTs && sender !== this.playerNumber) {
            this._lastSeenTs = ts;
            this._handleMessage(type, data);
          }
        } catch (_) {}
      }, 40);

      // Post presence on local bus
      setTimeout(() => {
        this._postLocal('presence', { isHost: this.isHost });
      }, 80);
    }

    // 2. PeerJS Global WebRTC P2P (Cross-device / Internet multiplayer)
    try {
      if (this.isHost) {
        this.peer = new Peer(fullPeerId);

        this.peer.on('open', (id) => {
          console.log(`[P2P] Host listening on peer ID: ${id}`);
        });

        this.peer.on('connection', (connection) => {
          console.log(`[P2P] Incoming connection from peer: ${connection.peer}`);
          this._setupConnection(connection);
        });

        this.peer.on('error', (err) => {
          console.warn('[P2P] PeerJS host warning/error:', err.type, err.message);
          // If ID taken (e.g. refresh), reconnect gracefully
          if (err.type === 'unavailable-id') {
            console.log('[P2P] Reusing peer connection...');
          }
        });
      } else {
        // Guest connects to Host's room
        this.peer = new Peer();

        this.peer.on('open', () => {
          console.log(`[P2P] Guest connecting to ${fullPeerId}...`);
          const connection = this.peer.connect(fullPeerId, { reliable: true });
          this._setupConnection(connection);
        });

        this.peer.on('error', (err) => {
          console.warn('[P2P] PeerJS guest warning/error:', err.type, err.message);
        });
      }

      return true;
    } catch (err) {
      console.error('[P2P] Failed to initialize peer:', err);
      return false;
    }
  }

  _setupConnection(connection) {
    this.conn = connection;

    this.conn.on('open', () => {
      console.log(`[P2P] DataChannel opened with: ${this.conn.peer}`);
      this.connectedPeerId = this.conn.peer;

      if (this.isHost) {
        // Send role confirmation to guest
        this.conn.send({ type: 'role', data: { host: true } });
      }

      if (this.onPeerJoin) {
        this.onPeerJoin(this.connectedPeerId, this.playerNumber);
      }
    });

    this.conn.on('data', (msg) => {
      if (!msg || !msg.type) return;
      this._handleMessage(msg.type, msg.data);
    });

    this.conn.on('close', () => {
      console.log('[P2P] Connection closed');
      this.connectedPeerId = null;
      if (this.onPeerLeave) {
        this.onPeerLeave();
      }
    });

    this.conn.on('error', (err) => {
      console.warn('[P2P] Connection error:', err);
    });
  }

  _handleMessage(type, data) {
    if (type === 'presence') {
      if (!this.connectedPeerId) {
        this.connectedPeerId = 'local-peer';
        if (this.isHost) {
          this._postLocal('role', { host: true });
        }
        if (this.onPeerJoin) {
          this.onPeerJoin('local-peer', this.playerNumber);
        }
      }
      return;
    }

    if (type === 'role') {
      if (!this.isHost) {
        this.connectedPeerId = 'local-host';
        this.playerNumber = 2;
        if (this.onPeerJoin) {
          this.onPeerJoin('local-host', this.playerNumber);
        }
      }
      return;
    }

    if (type === 'aim' && this.onOpponentAim) {
      this.onOpponentAim(data);
    } else if (type === 'shot' && this.onOpponentShot) {
      this.onOpponentShot(data);
    } else if (type === 'sync' && this.onStateSync) {
      this.onStateSync(data);
    } else if (type === 'emote' && this.onEmote) {
      this.onEmote(data);
    } else if (type === 'rematch' && this.onRematch) {
      this.onRematch(data);
    }
  }

  _postLocal(type, data) {
    if (typeof localStorage !== 'undefined' && this.roomCode) {
      try {
        localStorage.setItem(`kawaii_bus_${this.roomCode}`, JSON.stringify({
          type,
          data,
          sender: this.playerNumber,
          ts: Date.now() + Math.random()
        }));
      } catch (_) {}
    }
  }

  _sendP2P(type, data) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send({ type, data });
      } catch (_) {}
    }
  }

  sendAim(aimData) {
    const now = performance.now();
    if (!aimData.active && now - this._lastAimTime < 33) return;
    this._lastAimTime = now;

    this._postLocal('aim', aimData);
    this._sendP2P('aim', aimData);
  }

  sendShot(shotData) {
    this._postLocal('shot', shotData);
    this._sendP2P('shot', shotData);
  }

  sendSync(stateData) {
    if (!this.isHost) return;
    this._postLocal('sync', stateData);
    this._sendP2P('sync', stateData);
  }

  sendEmote(emote) {
    const data = { emote, playerNumber: this.playerNumber };
    this._postLocal('emote', data);
    this._sendP2P('emote', data);
  }

  sendRematch() {
    const data = { playerNumber: this.playerNumber };
    this._postLocal('rematch', data);
    this._sendP2P('rematch', data);
  }

  leaveRoom() {
    if (this._onStorage && typeof window !== 'undefined') {
      window.removeEventListener('storage', this._onStorage);
      this._onStorage = null;
    }
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this.conn) {
      try { this.conn.close(); } catch (_) {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
    this.connectedPeerId = null;
    this.roomCode = null;
  }
}

export const network = new PoolNetwork();
