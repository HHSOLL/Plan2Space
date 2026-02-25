"use client";

import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Float,
  Environment,
  PerspectiveCamera,
  Text,
  Html,
  Center,
  Text3D,
  AdaptiveDpr,
  Preload
} from "@react-three/drei";
import { useState, Suspense } from "react";
import * as THREE from "three";
import { Plus, LayoutDashboard, Users } from "lucide-react";

// Font URL for Text3D
const FONT_URL = "https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json";

function BlueprintGrid() {
  return (
    <group position={[0, -1.95, 0]}>
      {/* Structural Blueprint Lines */}
      <gridHelper args={[100, 100, "#e5e5e5", "#f0f0f0"]} />

      {/* Measurement Lines (Stylized) */}
      <group position={[5, 0, 5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.02, 10]} />
          <meshBasicMaterial color="#0000ff" transparent opacity={0.2} />
        </mesh>
        <Text
          position={[0, 0, 5]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.2}
          color="#0000ff"
        >
          12.5m
        </Text>
      </group>
    </group>
  );
}

function FloatingButton({ position, label, icon: Icon, onClick }: { position: [number, number, number], label: string, icon: any, onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <group position={position} onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}>
        <mesh
          onPointerOver={() => {
            setHovered(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = 'auto';
          }}
          castShadow
        >
          <sphereGeometry args={[0.45, 32, 32]} />
          <meshPhysicalMaterial
            color={hovered ? "#222" : "#ffffff"}
            roughness={0.05}
            metalness={0.1}
            transmission={0.4}
            thickness={1}
            ior={1.5}
            clearcoat={1}
          />
        </mesh>

        <group position={[0, 0, 0.5]}>
          <Html transform distanceFactor={1.5} pointerEvents="none">
            <div className={`transition-all duration-300 ${hovered ? 'text-white scale-110' : 'text-black/20'}`}>
              <Icon size={24} strokeWidth={2} />
            </div>
          </Html>
        </group>

        <Text
          position={[0, -0.7, 0]}
          fontSize={0.12}
          color={hovered ? "#000" : "#bbb"}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.1}
        >
          {label.toUpperCase()}
        </Text>
      </group>
    </Float>
  );
}

function InteriorStudio() {
  return (
    <group position={[0, -2, -2]}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>

      {/* Modern Back Wall */}
      <mesh position={[0, 5, -10]} receiveShadow>
        <planeGeometry args={[50, 25]} />
        <meshStandardMaterial color="#fcfcfc" />
      </mesh>

      {/* Side Column */}
      <group position={[-12, 4, -5]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 12, 4]} />
          <meshStandardMaterial color="#f8f8f8" />
        </mesh>
      </group>

      {/* Sofa */}
      <group position={[8, 0.4, -4]} rotation={[0, -0.6, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[6, 1, 2.5]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 1, -0.9]} castShadow receiveShadow>
          <boxGeometry args={[6, 2, 0.5]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Coffee Table */}
      <mesh position={[5, 0.2, -1]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.4, 2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.1} />
      </mesh>

      {/* Wall Measurement */}
      <Text
        position={[-11.4, 6, -3]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.2}
        color="#0000ff"
        material-opacity={0.3}
        material-transparent
      >
        H: 2.8m
      </Text>

      <BlueprintGrid />
    </group>
  );
}

function SceneContent({ onAction }: { onAction: (id: string) => void }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 4, 18]} fov={38} />

      {/* Performance Optimized Lighting */}
      <ambientLight intensity={0.8} />
      <Environment preset="studio" />

      <directionalLight
        position={[15, 25, 15]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />

      <InteriorStudio />

      {/* 3D Extruded Logo */}
      <Float speed={1} rotationIntensity={0.05} floatIntensity={0.05}>
        <group position={[0, 6, -6]}>
          <Center top>
            <Text3D
              font={FONT_URL}
              size={1.6}
              height={0.2}
              curveSegments={12}
              bevelEnabled
              bevelThickness={0.02}
              bevelSize={0.02}
              bevelOffset={0}
              bevelSegments={5}
            >
              MH_STUDIO
              <meshPhysicalMaterial
                color="#1a1a1a"
                roughness={0.1}
                metalness={0.1}
              />
            </Text3D>
          </Center>
          <Text
            position={[0, -0.7, 0.4]}
            fontSize={0.2}
            color="#999999"
            anchorX="center"
            anchorY="middle"
            letterSpacing={1.2}
            font="https://fonts.gstatic.com/s/cormorantgaramond/v11/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYpHtK.woff"
          >
            S P A T I A L   A R C H I V E
          </Text>
        </group>
      </Float>

      {/* Menu buttons */}
      <group position={[0, 1, 5]}>
        <FloatingButton position={[-2.5, 1, 0]} label="New Project" icon={Plus} onClick={() => onAction('new')} />
        <FloatingButton position={[0, 1, 0]} label="Dashboard" icon={LayoutDashboard} onClick={() => onAction('dashboard')} />
        <FloatingButton position={[2.5, 1, 0]} label="Gallery" icon={Users} onClick={() => onAction('community')} />
      </group>

      <ContactShadows position={[0, -2, 0]} opacity={0.1} scale={40} blur={4} far={15} />

      <AdaptiveDpr pixelated />
      <Preload all />
    </>
  );
}

export function LandingHeroCanvas({ onAction }: { onAction: (id: string) => void }) {
  return (
    <div className="fixed inset-0 bg-[#fdfdfc]" style={{ zIndex: 0 }}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        gl={{ antialias: true, stencil: false, depth: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <SceneContent onAction={onAction} />
        </Suspense>
      </Canvas>
    </div>
  );
}
