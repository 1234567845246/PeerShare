<script setup lang="ts">
 import { onMounted } from 'vue';

 interface ElectronAPI {
  startServer: (port: number) => Promise<{ success: boolean }>;
  stopServer: () => Promise<{ success: boolean }>;
  connectClient: (host: string, port: number) => Promise<{ success: boolean }>;
  disconnectClient: () => Promise<{ success: boolean }>;
  sendMessage: (message: string) => Promise<{ success: boolean }>;
  onTcpStatus: (callback: (data: any) => void) => void;
  onTcpMessage: (callback: (data: any) => void) => void;
  onTcpError: (callback: (data: any) => void) => void;
  removeAllListeners: (channel: string) => void;
}


declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

class WebRTCFileTransfer {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private fileReader: FileReader | null = null;
  private currentFile: File | null = null;
  private chunkSize: number = 16 * 1024; // 16KB chunks
  private currentChunk: number = 0;
  private totalChunks: number = 0;

  constructor() {
    this.setupEventListeners();
    this.initializeWebRTC();
  }

  private initializeWebRTC() {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // 处理 ICE 候选
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // 处理连接状态
    this.peerConnection.onconnectionstatechange = () => {
      this.updateConnectionStatus();
    };

    // 设置数据通道
    this.setupDataChannel();
  }

  private setupDataChannel() {
    // 创建数据通道用于文件传输
    this.dataChannel = this.peerConnection!.createDataChannel('fileTransfer', {
      ordered: true
    });

    this.dataChannel.onopen = () => {
      this.log('Data channel opened');
      this.updateDataChannelStatus('Connected');
      (document.getElementById('sendFile')as HTMLButtonElement)!.disabled = false;
    };

    this.dataChannel.onclose = () => {
      this.log('Data channel closed');
      this.updateDataChannelStatus('Disconnected');
      (document.getElementById('sendFile')as HTMLButtonElement)!.disabled = true;
    };

    this.dataChannel.onerror = (error) => {
      this.log(`Data channel error: ${error}`);
    };

    this.dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };

    // 监听远程数据通道
    this.peerConnection!.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onopen = () => {
        this.log('Remote data channel opened');
        this.updateDataChannelStatus('Connected');
        (document.getElementById('sendFile')as HTMLButtonElement)!.disabled = false;
      };
      channel.onmessage = (event) => {
        this.handleDataChannelMessage(event.data);
      };
    };
  }

  private handleDataChannelMessage(data: string) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'file-info':
          this.prepareFileReceival(message);
          break;
        case 'file-chunk':
          this.receiveFileChunk(message);
          break;
        case 'file-end':
          this.finalizeFileReceival();
          break;
        case 'handshake':
          this.log(`Handshake: ${message.message}`);
          break;
      }
    } catch (error) {
      this.log(`Error parsing message: ${error}`);
    }
  }

  async createOffer() {
    if (!this.peerConnection) return;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: 'offer',
        sdp: offer.sdp
      });
    } catch (error) {
      this.log(`Error creating offer: ${error}`);
    }
  }

  async handleOffer(offerSdp: string) {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription({
        type: 'offer',
        sdp: offerSdp
      });

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.sendSignalingMessage({
        type: 'answer',
        sdp: answer.sdp
      });
    } catch (error) {
      this.log(`Error handling offer: ${error}`);
    }
  }

  async handleAnswer(answerSdp: string) {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });
    } catch (error) {
      this.log(`Error handling answer: ${error}`);
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      this.log(`Error adding ICE candidate: ${error}`);
    }
  }

  private sendSignalingMessage(message: any) {
    const messageStr = JSON.stringify(message);
    window.electronAPI.sendMessage(messageStr);
  }

  sendFile(file: File) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      this.log('Data channel not ready');
      return;
    }

    this.currentFile = file;
    this.totalChunks = Math.ceil(file.size / this.chunkSize);
    this.currentChunk = 0;

    // 发送文件信息
    this.dataChannel.send(JSON.stringify({
      type: 'file-info',
      name: file.name,
      size: file.size,
      filetype: file.type,
      totalChunks: this.totalChunks
    }));

    this.readAndSendChunk();
  }

  private readAndSendChunk() {
    if (!this.currentFile || !this.dataChannel) return;

    const start = this.currentChunk * this.chunkSize;
    const end = Math.min(start + this.chunkSize, this.currentFile.size);
    const chunk = this.currentFile.slice(start, end);

    this.fileReader = new FileReader();
    this.fileReader.onload = (e) => {
      if (this.dataChannel && e.target?.result) {
        // 发送文件块
        this.dataChannel.send(JSON.stringify({
          type: 'file-chunk',
          chunk: Array.from(new Uint8Array(e.target.result as ArrayBuffer)),
          chunkIndex: this.currentChunk,
          totalChunks: this.totalChunks
        }));

        this.currentChunk++;
        this.updateProgress((this.currentChunk / this.totalChunks) * 100);

        if (this.currentChunk < this.totalChunks) {
          setTimeout(() => this.readAndSendChunk(), 0); // 非阻塞
        } else {
          // 文件发送完成
          this.dataChannel.send(JSON.stringify({
            type: 'file-end'
          }));
          this.log('File transfer completed');
        }
      }
    };

    this.fileReader.readAsArrayBuffer(chunk);
  }

  private prepareFileReceival(info: any) {
    this.log(`Preparing to receive file: ${info.name} (${info.size} bytes)`);
    this.receivedChunks = new Array(info.totalChunks);
    this.expectedFileSize = info.size;
    this.expectedFileName = info.name;
    this.expectedFileType = info.filetype;
    this.expectedTotalChunks = info.totalChunks;
    this.receivedChunksCount = 0;
  }

  private receivedChunks: Uint8Array[] = [];
  private expectedFileSize: number = 0;
  private expectedFileName: string = '';
  private expectedFileType: string = '';
  private expectedTotalChunks: number = 0;
  private receivedChunksCount: number = 0;

  private receiveFileChunk(message: any) {
    this.receivedChunks[message.chunkIndex] = new Uint8Array(message.chunk);
    this.receivedChunksCount++;

    const progress = (this.receivedChunksCount / this.expectedTotalChunks) * 100;
    this.updateProgress(progress);

    if (this.receivedChunksCount === this.expectedTotalChunks) {
      this.finalizeFileReceival();
    }
  }

  private finalizeFileReceival() {
    // 合并所有块
    const fileData = new Uint8Array(this.expectedFileSize);
    let offset = 0;

    for (const chunk of this.receivedChunks) {
      fileData.set(chunk, offset);
      offset += chunk.length;
    }

    // 创建下载链接
    const blob = new Blob([fileData], { type: this.expectedFileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.expectedFileName;
    a.click();

    URL.revokeObjectURL(url);
    this.log(`File received: ${this.expectedFileName}`);
    this.updateProgress(0);
  }

  private updateProgress(percent: number) {
    const progressBar = document.getElementById('progress') as HTMLDivElement;
    const progressText = document.getElementById('progressText') as HTMLDivElement;

    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${Math.round(percent)}%`;
  }

  private updateConnectionStatus() {
    const statusElement = document.getElementById('webrtcStatus') as HTMLDivElement;
    if (this.peerConnection) {
      statusElement.textContent = `WebRTC: ${this.peerConnection.connectionState}`;
    }
  }

  private updateDataChannelStatus(status: string) {
    const statusElement = document.getElementById('dataChannelStatus') as HTMLDivElement;
    statusElement.textContent = `Data Channel: ${status}`;
  }

  private log(message: string) {
    const logElement = document.getElementById('log') as HTMLDivElement;
    const timestamp = new Date().toLocaleTimeString();
    logElement.innerHTML += `[${timestamp}] ${message}\n`;
    logElement.scrollTop = logElement.scrollHeight;
  }

  private setupEventListeners() {
    // TCP 控制
    document.getElementById('startServer')!.addEventListener('click', () => {
      const port = parseInt((document.getElementById('serverPort') as HTMLInputElement).value);
      window.electronAPI.startServer(port);
    });

    document.getElementById('stopServer')!.addEventListener('click', () => {
      window.electronAPI.stopServer();
    });

    document.getElementById('connectClient')!.addEventListener('click', () => {
      const host = (document.getElementById('clientHost') as HTMLInputElement).value;
      const port = parseInt((document.getElementById('clientPort') as HTMLInputElement).value);
      window.electronAPI.connectClient(host, port);
    });

    document.getElementById('disconnectClient')!.addEventListener('click', () => {
      window.electronAPI.disconnectClient();
    });

    document.getElementById('sendMessage')!.addEventListener('click', () => {
      const message = (document.getElementById('messageInput') as HTMLTextAreaElement).value;
      window.electronAPI.sendMessage(message);
    });

    // 文件传输
    document.getElementById('sendFile')!.addEventListener('click', () => {
      const fileInput = document.getElementById('fileInput') as HTMLInputElement;
      if (fileInput.files && fileInput.files[0]) {
        this.sendFile(fileInput.files[0]);
      }
    });

    document.getElementById('startTransfer')!.addEventListener('click', () => {
      this.createOffer();
    });

    // 监听 TCP 事件
    window.electronAPI.onTcpStatus((data) => {
      this.log(`TCP Status: ${JSON.stringify(data)}`);
      this.updateConnectionStatusElement(data);
    });

    window.electronAPI.onTcpMessage((data) => {
      this.log(`TCP Message from ${data.from}: ${data.data}`);
      this.handleSignalingMessage(data.data);
    });

    window.electronAPI.onTcpError((data) => {
      this.log(`TCP Error: ${data.error}`);
    });
  }

  private updateConnectionStatusElement(data: any) {
    const statusElement = document.getElementById('connectionStatus') as HTMLDivElement;

    switch (data.type) {
      case 'server-started':
        statusElement.textContent = `Server running on port ${data.port}`;
        (document.getElementById('startTransfer')as HTMLButtonElement)!.disabled = false;
        break;
      case 'client-connected':
        statusElement.textContent = `Connected to ${data.host}:${data.port}`;
        (document.getElementById('startTransfer')as HTMLButtonElement)!.disabled = false;
        break;
      case 'client-disconnected':
        statusElement.textContent = 'Disconnected';
        (document.getElementById('startTransfer')as HTMLButtonElement)!.disabled = true;
        break;
    }
  }


  private handleSignalingMessage(message: string) {
    try {
      const signalingMessage = JSON.parse(message);

      switch (signalingMessage.type) {
        case 'offer':
          this.handleOffer(signalingMessage.sdp);
          break;
        case 'answer':
          this.handleAnswer(signalingMessage.sdp);
          break;
        case 'ice-candidate':
          this.addIceCandidate(signalingMessage.candidate);
          break;
        case 'handshake':
          this.log(`Signaling: ${signalingMessage.message}`);
          break;
      }
    } catch (error) {
      this.log(`Error handling signaling message: ${error}`);
    }
  }
}
onMounted(()=>{
  new WebRTCFileTransfer();
})
</script>

<template>
  <h1>Electron File Transfer</h1>

  <div class="container">
    <div class="panel">
      <h2>TCP Signaling</h2>

      <div>
        <h3>Server Mode</h3>
        <input type="number" id="serverPort" placeholder="Port" value="8080">
        <button id="startServer">Start Server</button>
        <button id="stopServer" disabled>Stop Server</button>
      </div>

      <div>
        <h3>Client Mode</h3>
        <input type="text" id="clientHost" placeholder="Host" value="127.0.0.1">
        <input type="number" id="clientPort" placeholder="Port" value="8080">
        <button id="connectClient">Connect</button>
        <button id="disconnectClient" disabled>Disconnect</button>
      </div>

      <div>
        <h3>Signaling Messages</h3>
        <textarea id="messageInput" placeholder="Enter signaling message..."></textarea>
        <button id="sendMessage">Send Message</button>
      </div>

      <div class="status" id="connectionStatus">Not connected</div>
    </div>

    <div class="panel">
      <h2>WebRTC File Transfer</h2>

      <div>
        <h3>File Selection</h3>
        <input type="file" id="fileInput">
        <button id="sendFile" disabled>Send File</button>
        <button id="startTransfer" disabled>Start Transfer</button>
      </div>

      <div>
        <h3>Transfer Progress</h3>
        <div id="progressBar" style="border:1px solid #ccc; height:20px; margin:10px 0;">
          <div id="progress" style="background:#4CAF50; height:100%; width:0%;"></div>
        </div>
        <div id="progressText">0%</div>
      </div>

      <div>
        <h3>Connection Info</h3>
        <div id="webrtcStatus">WebRTC: Not connected</div>
        <div id="dataChannelStatus">Data Channel: Not connected</div>
      </div>
    </div>
  </div>

  <div>
    <h3>Log</h3>
    <div class="log" id="log"></div>
  </div>
</template>

<style scoped></style>
