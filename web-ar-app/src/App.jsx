import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
window.THREE = THREE;
import { THREEx } from '@ar-js-org/ar.js-threejs';
import './index.css';
import monaLisaMelumat from './assets/MonaLisaMelumat.png';
import monaLisaSes from './assets/MonaLisaSes.mp3';

export default function App() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [markerVisible, setMarkerVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const markerVisibleRef = useRef(false);

  useEffect(() => {
    const audio = new Audio(monaLisaSes);
    audio.preload = 'auto';
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', onEnded);
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  const requestCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Brauzer dəstəyi yoxdur.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1536 },
          height: { ideal: 1024 }
        }
      });
      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
    } catch (err) {
      setErrorMsg(err.message || "Kamera icazəsi alına bilmədi.");
    }
  };

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError('');
    try {
      audio.currentTime = 0;
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      setIsPlaying(false);
      setAudioError('Səs səsləndirilə bilmədi. Zəhmət olmasa yenidən cəhd edin.');
    }
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setAudioError('');
  };

  useEffect(() => {
    if (!markerVisible) {
      handleStop();
    }
  }, [markerVisible]);

  useEffect(() => {
    if (!permissionGranted || !containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0px';
    renderer.domElement.style.left = '0px';
    renderer.domElement.style.zIndex = '5';
    containerRef.current.appendChild(renderer.domElement);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const arToolkitSource = new THREEx.ArToolkitSource({
      sourceType: 'webcam',
      sourceWidth: 1536,
      sourceHeight: 960,
      displayWidth: 1536,
      displayHeight: 960
    });

    const onResize = () => {
      arToolkitSource.onResizeElement();
      arToolkitSource.copyElementSizeTo(renderer.domElement);
      if (arToolkitContext.arController !== null) {
        arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
      }
    };

    arToolkitSource.init(() => {
      setTimeout(onResize, 500);
      window.addEventListener('resize', onResize);
    });

    const arToolkitContext = new THREEx.ArToolkitContext({
      cameraParametersUrl: 'https://raw.githack.com/AR-js-org/AR.js/master/data/data/camera_para.dat',
      detectionMode: 'mono',
      maxDetectionRate: 60,
      canvasWidth: 1536,
      canvasHeight: 960
    });

    arToolkitContext.init(() => {
      camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
    });

    const markerGroup = new THREE.Group();
    scene.add(markerGroup);

    // Mona Lisa NFT Marker
    new THREEx.ArMarkerControls(arToolkitContext, markerGroup, {
      type: 'nft',
      descriptorsUrl: 'nft/MonaLisa',
      smooth: true,
      smoothCount: 15,
      smoothTolerance: 0.005,
      smoothThreshold: 3
    });

    // ─── Bilgi Paneli ───
    // Hiro'daki ile BİREBİR AYNI mantık, sadece NFT birimleriyle
    const texture = new THREE.TextureLoader().load(monaLisaMelumat);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.generateMipmaps = true;

    // MonaLisaMelumat.png: 1536×1024 → oran 1.5:1
    const PANEL_ASPECT = 1536 / 1024;
    const geometry = new THREE.PlaneGeometry(PANEL_ASPECT, 1);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const panel = new THREE.Mesh(geometry, material);

    // Hiro'daki gibi: yatay düzlemde duran marker üzerinde paneli dikeye kaldır
    panel.rotation.x = -Math.PI / 2;

    // NFT koordinat sistemi: (0,0)=sol alt, (~184,~274)=sağ üst
    // X=92 → yatay merkez, Z=-100 → biraz aşağıda (rotation sonrası Z = eski Y)
    // Y=0.1 → yüzeyden hafif yukarıda
    panel.position.set(92, 0.1, -100);
    panel.scale.set(100, 100, 100);
    markerGroup.add(panel);

    let req;
    const animate = () => {
      req = requestAnimationFrame(animate);
      if (arToolkitSource.ready !== false) {
        arToolkitContext.update(arToolkitSource.domElement);
      }

      const currentVisible = markerGroup.visible === true;
      if (currentVisible !== markerVisibleRef.current) {
        markerVisibleRef.current = currentVisible;
        setMarkerVisible(currentVisible);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(req);
      window.removeEventListener('resize', onResize);
      if (renderer.domElement && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      const video = document.querySelector('video');
      if (video && video.parentNode) {
        video.parentNode.removeChild(video);
      }
    };
  }, [permissionGranted]);

  return (
    <div className="app-container">
      {!permissionGranted ? (
        <div className="welcome-screen">
          <div className="glass-card">
            <h1>AR Sənət Bələdçisi</h1>
            <p>Mona Lisanın sirlərini kəşf etməyə hazırsınız?</p>
            <button onClick={requestCamera} className="start-btn">
              Kameranı Başlat
            </button>
            {errorMsg && <p className="error">{errorMsg}</p>}
          </div>
        </div>
      ) : (
        <div className="ar-overlay">
          <div ref={containerRef} className="canvas-container" />
          {markerVisible && (
            <div className="audio-controls">
              <button onClick={handlePlay} className="audio-btn">
                {isPlaying ? 'Səs səslənir' : 'Mona Lisa səsini səsləndir'}
              </button>
              <button
                onClick={handleStop}
                className="audio-btn audio-btn-stop"
                disabled={!isPlaying}
              >
                Dayandır
              </button>
            </div>
          )}
          {audioError && <div className="audio-error">{audioError}</div>}
          <div className="instruction-toast">
            Mona Lisa şəklini masaya qoyun və yuxarıdan baxın
          </div>
        </div>
      )}
    </div>
  );
}
