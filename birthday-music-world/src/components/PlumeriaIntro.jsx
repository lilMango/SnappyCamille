import React, { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * PlumeriaIntro - A beautiful, reusable entrance animation component
 * 
 * Features:
 * - Page covered with scattered Plumeria flowers
 * - Flowers drift away on mouse movement or after a timeout
 * - Smooth, organic floating animations
 * - Configurable timing, density, and behavior
 * 
 * Usage:
 *   <PlumeriaIntro>
 *     <YourPageContent />
 *   </PlumeriaIntro>
 */

// Beautiful SVG Plumeria flower component with gradient
const PlumeriaFlower = ({ style, size = 60, rotation = 0, variant = 0 }) => {
  // Different color variants for visual variety
  const colorSchemes = [
    { outer: '#FEFCF3', inner: '#FFE066', center: '#FFD700' }, // Classic white-yellow
    { outer: '#FFF5F5', inner: '#FFB7C5', center: '#FF69B4' }, // Pink
    { outer: '#FFFAF0', inner: '#FFCC80', center: '#FF9800' }, // Peachy
    { outer: '#FFF8DC', inner: '#FFE4B5', center: '#FFA500' }, // Cream-orange
    { outer: '#F0FFF0', inner: '#98FB98', center: '#90EE90' }, // Mint (rare)
  ];
  
  const colors = colorSchemes[variant % colorSchemes.length];
  const uniqueId = useMemo(() => `plumeria-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ ...style, transform: `${style?.transform || ''} rotate(${rotation}deg)` }}
    >
      <defs>
        <radialGradient id={`${uniqueId}-petal`} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor={colors.outer} />
          <stop offset="70%" stopColor={colors.inner} />
          <stop offset="100%" stopColor={colors.center} />
        </radialGradient>
        <filter id={`${uniqueId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.2" />
        </filter>
      </defs>
      <g filter={`url(#${uniqueId}-shadow)`}>
        {/* 5 petals arranged in a spiral pattern */}
        {[0, 72, 144, 216, 288].map((angle, i) => (
          <ellipse
            key={i}
            cx="50"
            cy="25"
            rx="18"
            ry="28"
            fill={`url(#${uniqueId}-petal)`}
            transform={`rotate(${angle} 50 50)`}
            style={{
              filter: 'saturate(1.1)',
            }}
          />
        ))}
        {/* Center of the flower */}
        <circle cx="50" cy="50" r="12" fill={colors.center} />
        <circle cx="50" cy="50" r="8" fill={colors.inner} opacity="0.7" />
        <circle cx="48" cy="48" r="3" fill="#FFF" opacity="0.5" />
      </g>
    </svg>
  );
};

// Generate scattered flower data with better coverage
const generateFlowers = (count, viewportWidth, viewportHeight) => {
  const flowers = [];
  
  // Create a grid-based distribution for better coverage, then add randomness
  const gridCols = Math.ceil(Math.sqrt(count * (viewportWidth / viewportHeight)));
  const gridRows = Math.ceil(count / gridCols);
  const cellWidth = viewportWidth / gridCols;
  const cellHeight = viewportHeight / gridRows;
  
  for (let i = 0; i < count; i++) {
    const gridX = i % gridCols;
    const gridY = Math.floor(i / gridCols);
    
    // Base position in grid cell with randomness
    const baseX = (gridX * cellWidth) + (Math.random() * cellWidth * 0.8);
    const baseY = (gridY * cellHeight) + (Math.random() * cellHeight * 0.8);
    
    // Some flowers can be extra-positioned for overlap
    const extraOffset = Math.random() > 0.7;
    
    flowers.push({
      id: i,
      x: baseX + (extraOffset ? (Math.random() - 0.5) * 80 : 0),
      y: baseY + (extraOffset ? (Math.random() - 0.5) * 80 : 0),
      size: 50 + Math.random() * 45, // Larger flowers for better coverage
      rotation: Math.random() * 360,
      // Weighted variant selection - more pink flowers (variant 1)
      variant: (() => {
        const rand = Math.random();
        if (rand < 0.4) return 1;      // 40% pink
        if (rand < 0.6) return 0;      // 20% classic white-yellow
        if (rand < 0.75) return 2;     // 15% peachy
        if (rand < 0.9) return 3;      // 15% cream-orange
        return 4;                       // 10% mint
      })(),
      delay: Math.random() * 0.6, // Staggered animation delay
      duration: 1.0 + Math.random() * 0.8, // Varied animation duration
      // Direction and distance for floating away - flowers drift outward from center
      exitAngle: Math.atan2(baseY - viewportHeight/2, baseX - viewportWidth/2) + (Math.random() - 0.5) * 0.5,
      exitDistance: 200 + Math.random() * 400,
      rotationSpeed: (Math.random() - 0.5) * 540, // How much to spin while leaving
      // Gentle floating animation parameters
      floatAmplitude: 3 + Math.random() * 8,
      floatSpeed: 2 + Math.random() * 3,
      floatPhase: Math.random() * Math.PI * 2,
      // Z-index for layering
      zIndex: Math.floor(Math.random() * 10),
    });
  }
  
  return flowers;
};

const PlumeriaIntro = ({ 
  children,
  // Configuration options
  flowerCount = 45,           // Number of flowers
  autoRevealDelay = 4000,     // Auto-reveal after this many ms (set to 0 to disable)
  revealOnInteraction = true, // Reveal on mouse move or touch
  interactionThreshold = 50,  // Pixels of movement before triggering
  backgroundColor = 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #ff6a88 75%, #ffecd2 100%)',
  onRevealStart,              // Callback when reveal animation starts
  onRevealComplete,           // Callback when reveal animation completes
}) => {
  const [isRevealing, setIsRevealing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [mouseMovement, setMouseMovement] = useState(0);
  const [flowers, setFlowers] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Initialize flowers on mount
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Generate flowers when dimensions are set
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      setFlowers(generateFlowers(flowerCount, dimensions.width, dimensions.height));
    }
  }, [dimensions, flowerCount]);

  // Trigger reveal animation
  const triggerReveal = useCallback(() => {
    if (!isRevealing && !isComplete) {
      setIsRevealing(true);
      onRevealStart?.();
      
      // Mark complete after animations finish
      const maxDuration = 2500; // Max animation duration
      setTimeout(() => {
        setIsComplete(true);
        onRevealComplete?.();
      }, maxDuration);
    }
  }, [isRevealing, isComplete, onRevealStart, onRevealComplete]);

  // Auto-reveal timer
  useEffect(() => {
    if (autoRevealDelay > 0 && !isRevealing && !isComplete) {
      const timer = setTimeout(triggerReveal, autoRevealDelay);
      return () => clearTimeout(timer);
    }
  }, [autoRevealDelay, isRevealing, isComplete, triggerReveal]);

  // Mouse/touch interaction handler
  useEffect(() => {
    if (!revealOnInteraction || isRevealing || isComplete) return;

    let lastX = 0;
    let lastY = 0;
    let totalMovement = 0;

    const handleMove = (clientX, clientY) => {
      if (lastX !== 0 || lastY !== 0) {
        const dx = clientX - lastX;
        const dy = clientY - lastY;
        totalMovement += Math.sqrt(dx * dx + dy * dy);
        setMouseMovement(totalMovement);
        
        if (totalMovement >= interactionThreshold) {
          triggerReveal();
        }
      }
      lastX = clientX;
      lastY = clientY;
    };

    const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleClick = () => triggerReveal();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('click', handleClick);
    };
  }, [revealOnInteraction, isRevealing, isComplete, interactionThreshold, triggerReveal]);

  // Skip rendering overlay if complete
  if (isComplete) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Main content (hidden behind flowers initially) */}
      <div 
        style={{ 
          opacity: isRevealing ? 1 : 0,
          transition: 'opacity 1.2s ease-out',
          transitionDelay: isRevealing ? '0.3s' : '0s',
        }}
      >
        {children}
      </div>
      
      {/* Flower overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: isRevealing ? 'transparent' : backgroundColor,
          pointerEvents: isRevealing ? 'none' : 'auto',
          transition: 'background 1.5s ease-out',
          overflow: 'hidden',
          zIndex: 9999,
        }}
      >
        {/* Semi-transparent backing layer for full coverage */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: isRevealing ? 'transparent' : 'rgba(20, 20, 40, 0.85)',
            transition: 'background 0.8s ease-out',
          }}
        />
        
        {/* Animated flowers */}
        {flowers.map((flower) => {
          // Calculate exit position
          const exitX = Math.cos(flower.exitAngle) * flower.exitDistance;
          const exitY = Math.sin(flower.exitAngle) * flower.exitDistance;
          
          return (
            <div
              key={flower.id}
              style={{
                position: 'absolute',
                left: flower.x,
                top: flower.y,
                zIndex: flower.zIndex,
                transform: isRevealing 
                  ? `translate(${exitX}px, ${exitY}px) rotate(${flower.rotation + flower.rotationSpeed}deg) scale(0)`
                  : `translate(0, 0) rotate(${flower.rotation}deg) scale(1)`,
                opacity: isRevealing ? 0 : 1,
                transition: `all ${flower.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
                transitionDelay: `${flower.delay}s`,
                animation: !isRevealing ? `plumeriaFloat${flower.id % 3} ${flower.floatSpeed}s ease-in-out infinite` : 'none',
                animationDelay: `${flower.floatPhase}s`,
              }}
            >
              <PlumeriaFlower
                size={flower.size}
                rotation={0}
                variant={flower.variant}
              />
            </div>
          );
        })}
        
        {/* Hint text */}
        {!isRevealing && (
          <div
            style={{
              position: 'absolute',
              bottom: '10%',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              color: 'white',
              textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              animation: 'fadeInUp 1s ease-out 1s both, pulse 2s ease-in-out infinite 2s',
            }}
          >
            <p style={{ 
              fontSize: '1.2rem', 
              fontWeight: '300',
              letterSpacing: '0.1em',
              fontFamily: "'Georgia', serif",
            }}>
              ✨ Move your mouse or tap to uncover ✨
            </p>
          </div>
        )}
      </div>
      
      {/* Keyframe animations */}
      <style>{`
        @keyframes plumeriaFloat0 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(3deg); }
        }
        @keyframes plumeriaFloat1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-8px) rotate(-2deg); }
          66% { transform: translateY(-15px) rotate(4deg); }
        }
        @keyframes plumeriaFloat2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-6px) rotate(2deg); }
          75% { transform: translateY(-10px) rotate(-3deg); }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default PlumeriaIntro;
