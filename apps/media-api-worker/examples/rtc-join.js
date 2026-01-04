/**
 * Blueprint 13 — RTC/WebRTC Join Room Example
 * Browser-side code for joining Party/Circle/Roulette
 */

async function joinRoom(roomId, roomKind = 'circle') {
  // 1. Create/resolve room
  const r = await fetch('https://api.ubl.agency/rtc/rooms', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({ 
      room_kind: roomKind, 
      room_id: roomId,
      max_participants: 8 
    })
  });
  const { ws_url, ice_servers, auth } = await r.json();

  // 2. Get user media
  const stream = await navigator.mediaDevices.getUserMedia({ 
    video: true, 
    audio: true 
  });
  
  // 3. Create RTCPeerConnection
  const pc = new RTCPeerConnection({ iceServers: ice_servers });
  stream.getTracks().forEach(t => pc.addTrack(t, stream));

  // 4. Create data channel (optional, for chat)
  const dc = pc.createDataChannel('chat');
  dc.onmessage = (e) => console.log('Chat:', e.data);

  // 5. Create offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // 6. Connect WebSocket for signaling
  const ws = new WebSocket(ws_url + `?token=${auth.token}`);
  
  ws.onmessage = async ({data}) => {
    const msg = JSON.parse(data);
    if (msg.type === 'answer') {
      await pc.setRemoteDescription(msg.sdp);
    }
    if (msg.type === 'ice') {
      await pc.addIceCandidate(msg.candidate);
    }
  };
  
  pc.onicecandidate = e => {
    if (e.candidate && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ice', candidate: e.candidate }));
    }
  };
  
  pc.ontrack = (e) => {
    // Add remote stream to video element
    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
      remoteVideo.srcObject = e.streams[0];
    }
  };

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
  };

  // Return PC for hand-over
  return { pc, ws, stream };
}

// Hand-over: trocar de sala sem interromper vídeo
async function handoverRoom(oldRoom, newRoomId, newRoomKind) {
  // 1. Criar novo PC na sala de destino
  const { pc: newPC, ws: newWS, stream } = await joinRoom(newRoomId, newRoomKind);
  
  // 2. Negociar
  // (código de sinalização similar ao acima)
  
  // 3. Trocar srcObject das <video> tags
  const localVideo = document.getElementById('local-video');
  const remoteVideo = document.getElementById('remote-video');
  
  if (localVideo && stream) {
    localVideo.srcObject = stream; // Mesmo stream local
  }
  
  // 4. Fechar PC antigo
  oldRoom.pc.close();
  oldRoom.ws.close();
  
  return { pc: newPC, ws: newWS, stream };
}

// Export for use in app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { joinRoom, handoverRoom };
}
