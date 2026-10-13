import React, { useEffect, useRef } from 'react';

/**
 * GenesisAnimatedLogo
 * Continuous vector logo genesis and liquid fusion animation.
 */

const PATH_1 = "M1743.24 591.184C1763.49 588.065 1779.49 588.21 1789.9 588.929C1795.09 589.287 1799.08 589.799 1801.88 590.208C1803.69 590.472 1804.26 590.576 1806.48 590.918C1806.94 590.988 1808.12 591.17 1809.57 591.365C1851.94 599.477 1874.56 617.468 1885.72 627.416C1928.73 665.735 1949.57 708.395 1954.65 768.035C1955.1 792.977 1950.01 808.672 1943.9 817.863C1937.71 822.164 1931.59 824.157 1926.08 824.596C1919.36 823.543 1910.76 819.848 1897.13 806.32C1896.49 805.684 1895.84 805.056 1895.18 804.438C1893.27 802.644 1888.64 798.568 1885.48 795.78C1881.32 792.108 1875.97 787.395 1870.67 782.729C1865.35 778.039 1860.08 773.396 1856 769.798C1850.94 765.326 1849.7 764.201 1850.51 764.97C1850 764.491 1849.49 764.017 1848.97 763.55C1789.45 710.147 1734.11 690.436 1671.05 674.231C1656.87 670.402 1650.48 665.746 1647.33 662.244C1645.28 657.458 1645.03 653.872 1646.13 648.718C1651.27 635.563 1661.81 623.032 1685.82 610.204C1705.58 600.581 1725.76 593.878 1743.24 591.184Z";
const PATH_2 = "M929.283 124.217C1001.47 86.2858 1090.25 95.4908 1156.38 147.304C1198.88 184.821 1224.41 230.358 1230.93 280.675C1234.5 350.117 1218.71 402.266 1178.51 448.476C1163.89 464.572 1147 478.274 1125.04 492.379L1124.19 492.928C1059.45 535.427 1020.74 592.206 1001.51 664.146C1000.9 666.456 1000.36 668.786 999.908 671.133C983.319 757.317 1009.18 829.255 1049.13 888.929C1050.54 891.04 1052.03 893.098 1053.6 895.097C1107.11 963.289 1182.68 986.268 1242.46 994.214C1245.27 994.587 1248.09 994.842 1250.92 994.978C1265.48 995.678 1277.94 994.647 1288.29 993.351C1289.89 993.182 1290.83 993.083 1291.78 992.982C1292.91 992.863 1294.06 992.742 1296.35 992.501C1298.08 992.319 1299.8 992.092 1301.52 991.82C1349.27 984.279 1388.82 964.122 1413.4 952.415C1462.15 929.61 1516.65 925.416 1562.37 940.861C1621.57 963.168 1663.64 1000.65 1689.71 1054.57C1700.64 1080.88 1705.37 1107.87 1708.6 1147.92C1708.61 1148.03 1708.62 1148.15 1708.63 1148.26C1713.95 1211.64 1733.94 1280.91 1794.56 1337.48C1796.31 1339.11 1798.12 1340.68 1799.98 1342.18C1816.26 1355.34 1833.1 1366.09 1844.67 1373.54C1900.08 1410.06 1932.03 1458.53 1947.45 1527.17C1954.11 1586.32 1939.32 1639.19 1902.8 1687.9C1870.52 1728.31 1823.33 1756.12 1773.74 1763.78C1707.86 1768.66 1656.15 1754.57 1612.12 1718.31C1568.48 1679.53 1544.03 1636.23 1535.57 1581.71C1535.3 1575.91 1535.06 1570.06 1534.85 1564.17C1534.84 1563.87 1534.83 1563.56 1534.82 1563.25L1534.77 1562.33L1534.59 1559.21C1530.59 1493.47 1511.22 1415.93 1445.48 1355.42C1444.55 1354.57 1443.61 1353.74 1442.66 1352.92L1441.7 1352.11L1440.34 1350.99C1382.74 1303.61 1313.54 1282.57 1240.19 1287.99C1238.59 1288.11 1237 1288.27 1235.41 1288.46L1233.82 1288.67C1173.55 1296.99 1103.94 1324.52 1056.03 1384.9C1055.38 1385.73 1054.73 1386.56 1054.1 1387.41L1053.48 1388.26C1010.87 1446.82 988.653 1511.75 995.209 1590.26C995.424 1592.84 995.739 1595.41 996.152 1597.96C1006.25 1660.46 1038.93 1728.88 1099.56 1773.42C1100.47 1774.08 1101.39 1774.73 1102.31 1775.37C1111.64 1781.75 1120.82 1787.68 1129.18 1793.01H1129.18C1179.63 1825.35 1211.3 1869.55 1227.62 1930.04C1227.69 1930.29 1227.75 1930.54 1227.82 1930.78C1228.19 1932.11 1228.56 1933.43 1228.93 1934.77C1229.07 1935.28 1229.21 1935.79 1229.35 1936.3C1237.38 1973.56 1231.66 2017.71 1213.31 2059.43L1212.86 2060.45C1211.85 2062.82 1211.34 2064.01 1210.83 2065.21C1210.44 2066.12 1210.05 2067.04 1209.44 2068.48C1202.71 2082.71 1192.42 2096.75 1174.14 2118.1C1174.08 2118.17 1174.02 2118.24 1173.96 2118.31C1173.2 2119.2 1171.34 2121.38 1169.87 2123.11C1139.86 2154.5 1090.49 2177.11 1045.29 2179.83C982.073 2181.8 933.048 2166.32 890.419 2129.7C889.264 2128.71 888.086 2127.74 886.887 2126.8C882.336 2123.24 884.864 2125.22 880.959 2122.16C850.21 2097.14 827.004 2051.8 819.446 1999.95C818.812 1992.46 818.412 1984.46 818.054 1975.04C818.052 1974.99 818.05 1974.93 818.048 1974.88C815.536 1911.34 798.372 1840.53 742.69 1780.77C740.993 1778.95 739.228 1777.19 737.401 1775.5L736.615 1774.78L735.266 1773.56C678.061 1722.33 610.029 1699.38 535.412 1702.05C534.195 1702.09 532.978 1702.16 531.764 1702.25L530.55 1702.34C475.34 1706.99 432.971 1728 402.845 1742.83C388.165 1749.94 375.58 1754.97 362.979 1758.59L362.935 1758.6C361.864 1758.91 360.794 1759.22 359.717 1759.53C358.961 1759.74 358.201 1759.96 357.436 1760.18C310.385 1772.61 254.546 1764.58 206.508 1738.46C190.699 1729.14 175.76 1716.51 156.812 1697.41L155.854 1696.46L150.795 1691.5C118.832 1657.2 100.681 1607.17 101.007 1553.97C103.041 1498.46 127.595 1447.95 174.162 1400.7C212.043 1366.54 262.458 1351.39 327.705 1353.1C354.61 1354.62 380.134 1362.38 412.814 1378.29C412.951 1378.36 413.088 1378.42 413.226 1378.49C478.238 1409.77 552.795 1426.24 637.523 1397.44C639.57 1396.74 641.593 1395.98 643.591 1395.15C715.294 1365.52 765.463 1318.65 798.298 1246.97C799.188 1245.02 800.017 1243.05 800.782 1241.05C808.873 1219.94 816.387 1195 818.686 1165.43C818.876 1163.36 819.024 1161.77 819.232 1159.5C819.356 1158.16 819.454 1156.81 819.523 1155.46C823.102 1086.18 798.846 1025.61 766.243 978.149C765.028 976.325 763.953 974.711 762.673 972.788C761.956 971.712 761.219 970.65 760.462 969.603L759.697 968.56L758.537 967.012C709.181 901.822 631.596 879.46 584.278 870.885C582.679 870.595 581.073 870.343 579.462 870.131L577.849 869.932L575.999 869.726C498.132 861.347 435.032 893.012 397.611 910.912C347.098 934.42 290.681 936.129 232.974 916.182C209.268 906.47 187.053 892.067 165.774 872.823C165.523 872.596 165.27 872.369 165.017 872.145L164.252 871.474L159.402 867.263C128.135 837.836 104.53 784.672 101.509 736.267C100.902 674.02 121.676 620.391 163.837 575.761C205.131 537.232 259.645 516.102 315.985 516.997C351.221 519.099 382.794 529.634 425.53 550.353C425.559 550.367 425.588 550.381 425.617 550.395C446.459 560.475 477.742 574.953 518.409 578.368C521.778 578.696 521.9 578.708 525.771 579.084C527.338 579.236 528.909 579.352 530.481 579.431C610.509 583.443 676.877 552.879 728.847 509.3C730.23 508.14 731.583 506.943 732.902 505.71C782.455 459.413 813.394 393.285 816.713 325.067C821.053 247.165 842.46 193.027 889.496 150.547C898.789 142.643 909.359 135.458 922.525 128.059C922.674 127.975 922.822 127.892 922.97 127.808C926.187 125.978 926.746 125.66 929.283 124.217Z";
const CENTER = { x: 1025.5, y: 1140.5 };

const LOBES = [
  { cx: 1025.5, cy: 308.0,  r: 206.5, delay: 0.00, absorbAt: 0.05, isDroplet: false },
  { cx: 1493.1, cy: 1148.0, r: 206.5, delay: 0.02, absorbAt: 0.20, isDroplet: false },
  { cx: 1742.6, cy: 1560.0, r: 206.5, delay: 0.04, absorbAt: 0.30, isDroplet: false },
  { cx: 1025.5, cy: 1974.3, r: 206.5, delay: 0.06, absorbAt: 0.50, isDroplet: false },
  { cx: 308.5,  cy: 1559.1, r: 206.5, delay: 0.08, absorbAt: 0.65, isDroplet: false },
  { cx: 308.5,  cy: 724.2,  r: 206.5, delay: 0.10, absorbAt: 0.87, isDroplet: false },
  { cx: 1800.0, cy: 706.0,  r: 112.0, delay: 0.05, absorbAt: 0.36, isDroplet: true  }
];

const CUTTERS = [
  { cx: 1268.6, cy: 725.4,  r: 271.5, appearAt: 0.11 },
  { cx: 1264.5, cy: 1558.2, r: 271.5, appearAt: 0.38 },
  { cx: 549.8,  cy: 1970.8, r: 271.5, appearAt: 0.57 },
  { cx: 547.7,  cy: 1140.1, r: 271.5, appearAt: 0.74 },
  { cx: 546.4,  cy: 308.0,  r: 271.5, appearAt: 0.94 }
];

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const invLerp = (a, b, v) => clamp((v - a) / (b - a));
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeOutBack = t => {
  const c1 = 1.55;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export default function GenesisAnimatedLogo({
  size = 64,
  width,
  height,
  color = 'currentColor',
  bgColor = '#121314',
  halo = true,
  haloColor = 'rgba(255, 255, 255, 0.10)',
  duration = 4800,
  speed = 1.0,
  interactive = true,
  className = '',
  style = {},
  onClick
}) {
  const svgRef = useRef(null);
  const corePathRef = useRef(null);
  const dropletPathRef = useRef(null);
  const leadDotRef = useRef(null);
  const seedElsRef = useRef([]);
  const cutterElsRef = useRef([]);

  const progressRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef(null);

  useEffect(() => {
    const corePath = corePathRef.current;
    const dropletPath = dropletPathRef.current;
    const leadDot = leadDotRef.current;

    if (!corePath || !dropletPath) return;

    let lenCore = 0;
    let lenDroplet = 0;

    try {
      lenCore = corePath.getTotalLength() || 0;
      lenDroplet = dropletPath.getTotalLength() || 0;
    } catch (_) {
      lenCore = 0;
      lenDroplet = 0;
    }

    function renderFrame(t) {
      t = clamp(t, 0, 1);

      if (lenCore === 0 && corePath) {
        try {
          lenCore = corePath.getTotalLength() || 0;
          lenDroplet = dropletPath.getTotalLength() || 0;
        } catch (_) {}
      }

      const collapseP = easeInOutCubic(invLerp(0.89, 0.995, t));
      const drawP = easeInOutCubic(invLerp(0.24, 0.72, t));
      const widthP = easeOutCubic(invLerp(0.24, 0.73, t));

      // 1. Sequential Absorption of 7 Bold Geometric Seeds
      seedElsRef.current.forEach((el, idx) => {
        if (!el) return;
        const data = LOBES[idx];
        if (!data) return;

        if (collapseP > 0) {
          const implodeFly = easeInOutCubic(invLerp(0.91, 0.995, t));
          const cx = data.cx + (CENTER.x - data.cx) * implodeFly;
          const cy = data.cy + (CENTER.y - data.cy) * implodeFly;
          const curR = (data.isDroplet ? 80 : 140) * (1 - implodeFly) + 42 * implodeFly;
          const alpha = Math.sin(collapseP * Math.PI);
          el.setAttribute('cx', cx.toFixed(1));
          el.setAttribute('cy', cy.toFixed(1));
          el.setAttribute('r', curR.toFixed(1));
          el.setAttribute('stroke-width', '185');
          el.setAttribute('opacity', (alpha * 0.95).toFixed(3));
        } else {
          const appearAlpha = easeOutCubic(invLerp(0.0, 0.04, t));
          const flyP = easeOutBack(invLerp(0.02 + data.delay * 0.35, 0.17 + data.delay * 0.35, t));
          const ringP = easeInOutCubic(invLerp(0.14 + data.delay * 0.25, 0.28 + data.delay * 0.25, t));

          const absorbStart = data.absorbAt - 0.04;
          const absorbEnd = data.absorbAt + 0.14;
          const absorbP = easeInOutCubic(invLerp(absorbStart, absorbEnd, drawP));
          const fadeOut = 1 - absorbP;

          if (fadeOut <= 0.005) {
            el.setAttribute('opacity', '0');
          } else {
            const cx = CENTER.x + (data.cx - CENTER.x) * flyP;
            const cy = CENTER.y + (data.cy - CENTER.y) * flyP;
            const targetR = data.isDroplet ? 95 : data.r;
            const swell = 1 + Math.sin(absorbP * Math.PI) * 0.06;
            const curR = (42 + (targetR - 42) * ringP) * swell;
            const curSW = data.isDroplet ? (140 + 51 * ringP) : (175 + 27 * ringP);

            el.setAttribute('cx', cx.toFixed(1));
            el.setAttribute('cy', cy.toFixed(1));
            el.setAttribute('r', curR.toFixed(1));
            el.setAttribute('stroke-width', (curSW * (1 - absorbP * 0.3)).toFixed(1));
            el.setAttribute('opacity', (appearAlpha * fadeOut).toFixed(3));
          }
        }
      });

      // 2. Negative-Space Tangent Cutter Rings
      cutterElsRef.current.forEach((el, idx) => {
        if (!el) return;
        const data = CUTTERS[idx];
        if (!data) return;

        const inP = easeOutBack(invLerp(0.16 + idx * 0.015, 0.28 + idx * 0.015, t));
        const passP = invLerp(data.appearAt - 0.08, data.appearAt + 0.12, drawP);
        const flash = Math.sin(passP * Math.PI);
        const outP = 1 - easeInOutCubic(invLerp(data.appearAt + 0.02, data.appearAt + 0.16, drawP));
        const baseAlpha = clamp(invLerp(0.16 + idx * 0.015, 0.22 + idx * 0.015, t)) * outP;
        const finalAlpha = (baseAlpha * 0.26 + flash * 0.28) * (1 - invLerp(0.70, 0.75, t));

        el.setAttribute('r', (data.r * Math.max(0.1, inP)).toFixed(1));
        el.setAttribute('opacity', Math.max(0, finalAlpha).toFixed(3));
      });

      // 3. Real-Time Ribbon Trace & Fusion
      if (t < 0.24) {
        corePath.setAttribute('opacity', '0');
        dropletPath.setAttribute('opacity', '0');
      } else if (collapseP > 0) {
        const rem = 1 - collapseP;
        const seg = lenCore > 0 ? lenCore / 5 : 500;
        corePath.style.strokeDasharray = `${(seg * rem).toFixed(1)} ${(seg * (1 - rem) + 0.1).toFixed(1)}`;
        corePath.style.strokeDashoffset = `${(-collapseP * seg * 0.5).toFixed(1)}`;
        corePath.setAttribute('stroke-width', (202 * (0.55 + 0.45 * rem)).toFixed(1));
        corePath.setAttribute('opacity', clamp(rem * 1.6, 0, 1).toFixed(3));

        dropletPath.style.strokeDasharray = `${(lenDroplet * rem).toFixed(1)} ${lenDroplet || 500}`;
        dropletPath.setAttribute('opacity', clamp(rem * 1.6, 0, 1).toFixed(3));
      } else if (drawP < 0.999 && lenCore > 0) {
        const L = lenCore;
        const drawn = L * drawP;
        corePath.style.strokeDasharray = `${drawn.toFixed(1)} ${L.toFixed(1)}`;
        corePath.style.strokeDashoffset = '0';
        corePath.setAttribute('stroke-width', (150 + 52 * widthP).toFixed(1));
        corePath.setAttribute('opacity', '1');

        const dP = easeOutExpo(invLerp(0.34, 0.68, t));
        const dDrawn = lenDroplet * dP;
        dropletPath.style.strokeDasharray = `${dDrawn.toFixed(1)} ${lenDroplet.toFixed(1)}`;
        dropletPath.style.strokeDashoffset = '0';
        dropletPath.setAttribute('stroke-width', (120 + 71 * dP).toFixed(1));
        dropletPath.setAttribute('opacity', dP > 0.01 ? '1' : '0');
      } else {
        corePath.style.strokeDasharray = 'none';
        corePath.style.strokeDashoffset = '0';
        corePath.setAttribute('stroke-width', '202');
        corePath.setAttribute('opacity', '1');

        dropletPath.style.strokeDasharray = 'none';
        dropletPath.style.strokeDashoffset = '0';
        dropletPath.setAttribute('stroke-width', '191');
        dropletPath.setAttribute('opacity', '1');
      }

      // 4. Negative-Space Vector Eyelet at Tip
      if (leadDot) {
        if (t >= 0.25 && t <= 0.71 && lenCore > 0) {
          const eyeAlpha = clamp(invLerp(0.25, 0.28, t)) * (1 - clamp(invLerp(0.68, 0.71, t)));
          try {
            const pt = corePath.getPointAtLength(drawP * lenCore);
            leadDot.setAttribute('cx', pt.x.toFixed(1));
            leadDot.setAttribute('cy', pt.y.toFixed(1));
            leadDot.setAttribute('opacity', eyeAlpha.toFixed(3));
          } catch (_) {
            leadDot.setAttribute('opacity', '0');
          }
        } else {
          leadDot.setAttribute('opacity', '0');
        }
      }
    }

    lastTimeRef.current = performance.now();

    function loop(now) {
      const dt = Math.min(now - lastTimeRef.current, 100) * speed;
      lastTimeRef.current = now;

      progressRef.current = (progressRef.current + dt / duration) % 1;
      renderFrame(progressRef.current);

      rafIdRef.current = requestAnimationFrame(loop);
    }

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [duration, speed, bgColor]);

  const handleContainerClick = (e) => {
    if (interactive) {
      progressRef.current = 0;
      lastTimeRef.current = performance.now();
    }
    if (onClick) {
      onClick(e);
    }
  };

  const containerWidth = width || size;
  const containerHeight = height || undefined;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{
        width: typeof containerWidth === 'number' ? `${containerWidth}px` : containerWidth,
        height: typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight,
        aspectRatio: '2051 / 2281',
        ...style
      }}
      onClick={handleContainerClick}
    >
      {halo && (
        <div
          className="absolute inset-[-24%] rounded-full pointer-events-none transition-transform duration-500 ease-out"
          style={{
            background: `radial-gradient(circle, ${haloColor} 0%, transparent 66%)`
          }}
        />
      )}

      <svg
        ref={svgRef}
        viewBox="0 0 2051 2281"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible block"
        style={{ color }}
      >
        <g>
          {CUTTERS.map((c, i) => (
            <circle
              key={`cutter-${i}`}
              ref={el => { cutterElsRef.current[i] = el; }}
              cx={c.cx}
              cy={c.cy}
              r={c.r}
              stroke="currentColor"
              strokeWidth="34"
              opacity="0"
            />
          ))}
        </g>

        <g>
          {LOBES.map((l, i) => (
            <circle
              key={`lobe-${i}`}
              ref={el => { seedElsRef.current[i] = el; }}
              cx={CENTER.x}
              cy={CENTER.y}
              r="101"
              fill="none"
              stroke="currentColor"
              strokeWidth="202"
              strokeLinecap="round"
              opacity="0"
            />
          ))}
        </g>

        <path
          ref={dropletPathRef}
          d={PATH_1}
          stroke="currentColor"
          strokeWidth="191"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0"
        />

        <path
          ref={corePathRef}
          d={PATH_2}
          stroke="currentColor"
          strokeWidth="202"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0"
        />

        <circle
          ref={leadDotRef}
          r="44"
          fill={bgColor}
          opacity="0"
        />
      </svg>
    </div>
  );
}
