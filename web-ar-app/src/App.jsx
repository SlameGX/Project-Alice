import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
window.THREE = THREE
import { THREEx } from '@ar-js-org/ar.js-threejs'
import './index.css' // CSS geri geldi
import monaLisaMelumat from './assets/MonaLisaMelumat.png'

export default function App() {
  const [permissionGranted, setPermissionGranted] = useState(false)
  const containerRef = useRef(null)

  const requestCamera = async () => {
    // Uzaktan algılama için yüksek çözünürlük isteği
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    })
    stream.getTracks().forEach(track => track.stop())
    setPermissionGranted(true)
  }

  useEffect(() => {
    if (!permissionGranted || !containerRef.current) return

    const scene = new THREE.Scene()
    const camera = new THREE.Camera()
    scene.add(camera)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    // Projeksiyon matrisiyle uyumlu 4:3 render boyutu
    renderer.setSize(1280, 960)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0px'
    renderer.domElement.style.left = '0px'
    containerRef.current.appendChild(renderer.domElement)

    const light = new THREE.AmbientLight(0xffffff, 1)
    scene.add(light)

    const arSource = new THREEx.ArToolkitSource({
      sourceType: 'webcam',
      sourceWidth: 1280,
      sourceHeight: 960,
      displayWidth: 1280,
      displayHeight: 960
    })

    const onResize = () => {
      arSource.onResizeElement()
      arSource.copyElementSizeTo(renderer.domElement)
      if (arContext.arController) arSource.copyElementSizeTo(arContext.arController.canvas)
    }

    arSource.init(() => {
      setTimeout(onResize, 1000)
      window.addEventListener('resize', onResize)
    })

    const arContext = new THREEx.ArToolkitContext({
      cameraParametersUrl: 'https://raw.githack.com/AR-js-org/AR.js/master/data/data/camera_para.dat',
      detectionMode: 'mono',
      maxDetectionRate: 60,
      canvasWidth: 1280,
      canvasHeight: 960
    })

    arContext.init(() => camera.projectionMatrix.copy(arContext.getProjectionMatrix()))

    const markerRoot = new THREE.Group()
    scene.add(markerRoot)

    new THREEx.ArMarkerControls(arContext, markerRoot, {
      type: 'nft',
      descriptorsUrl: 'nft/MonaLisa',
      smooth: true,
      smoothCount: 10,
      smoothTolerance: 0.05,
      smoothThreshold: 5
    })

    // Panel Ayarları
    const texture = new THREE.TextureLoader().load(monaLisaMelumat)
    const geometry = new THREE.PlaneGeometry(1, 1)
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
    const panel = new THREE.Mesh(geometry, material)

    // NFT'de (0,0) sol alttır. Merkeze (184/2, 274/2) alıp 
    // zıplamayı önlemek için yüzeye (Z: 2) yakın tutuyoruz.
    panel.position.set(92, 137, 2)
    panel.scale.set(184, 274, 1)
    markerRoot.add(panel)

    const smoothFactor = 0.15
    const targetQuat = new THREE.Quaternion()

    function animate() {
      requestAnimationFrame(animate)
      if (arSource.ready) {
        arContext.update(arSource.domElement)

        if (markerRoot.visible) {
          // Billboarding: Panel her zaman kameraya döner ama yerinden oynamaz
          panel.lookAt(camera.position)
        }
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      window.removeEventListener('resize', onResize)
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [permissionGranted])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {!permissionGranted ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#1a1a1a' }}>
          <button onClick={requestCamera} style={{ fontSize: 20, padding: '15px 30px', cursor: 'pointer', borderRadius: '10px', border: 'none', backgroundColor: '#00e5ff' }}>
            Kamerayı Başlat
          </button>
        </div>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  )
}
