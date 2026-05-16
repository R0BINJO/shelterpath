/*
 * SafeRoute Varjumine — Custom SVG interactive map.
 *
 * Why SVG instead of MapLibre / Google / Mapbox:
 *  - Spec forbids paid map APIs and external API keys.
 *  - MapLibre GL JS is web-only; this app is Expo (RN) and must work on native + web.
 *  - SVG renders identically on web + native via react-native-svg and works offline
 *    with zero network calls.
 *
 * HARDCODED MAP BACKGROUND: a stylised "city" grid is drawn here in SVG.
 *  - No real offline tiles are downloaded or shipped.
 *  - The grid + park polygons + water rectangle are purely decorative and demo-only.
 *
 * Geographic projection: a simple linear lat/lng -> SVG coordinate mapping centred on
 * the demo user location. Accurate enough for a few hundred metres at Tallinn's latitude.
 */

import { memo, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Polyline,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
  Text as SvgText,
} from 'react-native-svg';

import {
  DEMO_DANGER_ZONE,
  DEMO_USER_LOCATION,
  type RoutePolyline,
  SHELTERS,
  type Shelter,
} from '@/lib/shelters';
import { SHELTER_COLORS } from '@/lib/constants';

// --- Projection helpers ----------------------------------------------------
// SVG viewBox is in "world units" centred on the user. 1 world unit ~ 1 metre.
// At Tallinn (~59.4°N) 1° latitude ≈ 111_000 m, 1° longitude ≈ 56_500 m.
const METERS_PER_DEG_LAT = 111_000;
const METERS_PER_DEG_LNG = 56_500;
const VIEW_RADIUS_METERS = 900; // half-side of the viewport in metres

function projectMeters(lat: number, lng: number) {
  const dLat = lat - DEMO_USER_LOCATION.lat;
  const dLng = lng - DEMO_USER_LOCATION.lng;
  // SVG y grows downward → invert latitude.
  return {
    x: dLng * METERS_PER_DEG_LNG,
    y: -dLat * METERS_PER_DEG_LAT,
  };
}

type Props = {
  selectedShelterId: number | null;
  route: RoutePolyline | null;
  crisisMode: boolean;
  onSelectShelter: (s: Shelter) => void;
  zoom: number; // 0.6 – 2.5
};

function MapCanvasInner({
  selectedShelterId,
  route,
  crisisMode,
  onSelectShelter,
  zoom,
}: Props) {
  const half = VIEW_RADIUS_METERS;
  const viewBox = `${-half} ${-half} ${half * 2} ${half * 2}`;

  // Pan offset shared values.
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          savedX.value = translateX.value;
          savedY.value = translateY.value;
        })
        .onUpdate((e) => {
          translateX.value = savedX.value + e.translationX;
          translateY.value = savedY.value + e.translationY;
        }),
    [savedX, savedY, translateX, translateY],
  );

  const composed = panGesture;

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: withTiming(zoom, { duration: 180 }) },
    ],
  }));

  const userPt = projectMeters(DEMO_USER_LOCATION.lat, DEMO_USER_LOCATION.lng);
  const dangerPt = projectMeters(DEMO_DANGER_ZONE.centerLat, DEMO_DANGER_ZONE.centerLng);

  // Route polyline (lng/lat → projected metres).
  const routePoints = useMemo(() => {
    if (!route) return '';
    return route.coordinates
      .map(([lng, lat]) => {
        const p = projectMeters(lat, lng);
        return `${p.x},${p.y}`;
      })
      .join(' ');
  }, [route]);

  const handleMarkerPress = useCallback(
    (s: Shelter) => () => {
      onSelectShelter(s);
    },
    [onSelectShelter],
  );

  // Theme-aware background colours.
  const bg = crisisMode ? '#0c1624' : '#dde7f1';
  const land = crisisMode ? '#152234' : '#eef3f8';
  const grid = crisisMode ? '#1d2c41' : '#cdd9e6';
  const road = crisisMode ? '#243750' : '#ffffff';
  const roadStroke = crisisMode ? '#324a6b' : '#c5d2e0';
  const park = crisisMode ? '#1a3329' : '#cfe7d3';
  const water = crisisMode ? '#0f2a44' : '#bcd6ee';
  const labelColor = crisisMode ? '#5b7794' : '#6b7a8a';

  return (
    <GestureDetector gesture={composed}>
      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: bg }}>
        <Animated.View style={[{ flex: 1 }, animatedContainerStyle]}>
          <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
            <Defs>
              <SvgLinearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={SHELTER_COLORS.route} stopOpacity="0.85" />
                <Stop offset="1" stopColor={SHELTER_COLORS.route} stopOpacity="1" />
              </SvgLinearGradient>
            </Defs>

            {/* HARDCODED MAP BACKGROUND — base land + grid */}
            <Rect x={-half} y={-half} width={half * 2} height={half * 2} fill={land} />

            {/* Decorative park polygons (demo only) */}
            <Path
              d={`M ${-half + 80} ${-half + 120} L ${-half + 360} ${-half + 90} L ${-half + 380} ${-half + 280} L ${-half + 120} ${-half + 320} Z`}
              fill={park}
            />
            <Path
              d={`M ${half - 380} ${half - 320} L ${half - 120} ${half - 360} L ${half - 80} ${half - 140} L ${half - 320} ${half - 100} Z`}
              fill={park}
            />

            {/* Decorative water strip */}
            <Rect x={-half} y={half - 220} width={half * 2} height={220} fill={water} />

            {/* Subtle block grid */}
            {Array.from({ length: 13 }).map((_, i) => {
              const v = -half + i * 150;
              const key = `grid-${v}`;
              return (
                <G key={key}>
                  <Line x1={v} y1={-half} x2={v} y2={half} stroke={grid} strokeWidth={1} />
                  <Line x1={-half} y1={v} x2={half} y2={v} stroke={grid} strokeWidth={1} />
                </G>
              );
            })}

            {/* "Roads": a few thicker orthogonal strokes */}
            <Line x1={-half} y1={0} x2={half} y2={0} stroke={road} strokeWidth={26} />
            <Line
              x1={-half}
              y1={0}
              x2={half}
              y2={0}
              stroke={roadStroke}
              strokeWidth={28}
              strokeOpacity={0.35}
              fill="none"
            />
            <Line x1={0} y1={-half} x2={0} y2={half} stroke={road} strokeWidth={22} />
            <Line x1={-half} y1={-300} x2={half} y2={-300} stroke={road} strokeWidth={16} />
            <Line x1={-half} y1={300} x2={half} y2={300} stroke={road} strokeWidth={16} />
            <Line x1={-300} y1={-half} x2={-300} y2={half} stroke={road} strokeWidth={14} />
            <Line x1={300} y1={-half} x2={300} y2={half} stroke={road} strokeWidth={14} />

            {/* Diagonal demo street for visual variety */}
            <Line
              x1={-half}
              y1={half - 600}
              x2={half}
              y2={-half + 200}
              stroke={road}
              strokeWidth={12}
            />

            {/* Cardinal label */}
            <SvgText x={half - 60} y={-half + 50} fill={labelColor} fontSize={28} fontWeight="600">
              {/* oxlint-disable-next-line react-native/no-raw-text -- SvgText is not RN Text */}
              {'N'}
            </SvgText>

            {/* HARDCODED DEMO DANGER ZONE — transparent red overlay (visual only). */}
            <Circle
              cx={dangerPt.x}
              cy={dangerPt.y}
              r={DEMO_DANGER_ZONE.radiusMeters}
              fill={SHELTER_COLORS.danger}
              stroke={SHELTER_COLORS.dangerStroke}
              strokeWidth={3}
              strokeDasharray="14 8"
            />
            <SvgText
              x={dangerPt.x}
              y={dangerPt.y - DEMO_DANGER_ZONE.radiusMeters - 14}
              fill={SHELTER_COLORS.dangerStroke}
              fontSize={22}
              fontWeight="700"
              textAnchor="middle"
            >
              {/* oxlint-disable-next-line react-native/no-raw-text -- SvgText is not RN Text */}
              {'HAZARD (demo)'}
            </SvgText>

            {/* Route polyline (hardcoded — see lib/shelters.ts) */}
            {route ? (
              <>
                <Polyline
                  points={routePoints}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={crisisMode ? 0.35 : 0.6}
                  strokeWidth={22}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Polyline
                  points={routePoints}
                  fill="none"
                  stroke="url(#routeGrad)"
                  strokeWidth={14}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : null}

            {/* Shelter markers */}
            {SHELTERS.map((s) => {
              const p = projectMeters(s.lat, s.lng);
              const selected = s.id === selectedShelterId;
              const color = SHELTER_COLORS[s.type];
              const r = selected ? 34 : 26;
              return (
                <G
                  key={s.id}
                  onPress={handleMarkerPress(s)}
                  transform={`translate(${p.x}, ${p.y})`}
                >
                  {selected ? (
                    <Circle cx={0} cy={0} r={r + 18} fill={color} fillOpacity={0.18} />
                  ) : null}
                  <Circle cx={0} cy={0} r={r} fill={color} stroke="#ffffff" strokeWidth={3} />
                  <SvgText
                    x={0}
                    y={6}
                    fill="#0b1320"
                    fontSize={selected ? 20 : 16}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {s.type}
                  </SvgText>
                </G>
              );
            })}

            {/* User location marker (HARDCODED) */}
            <G transform={`translate(${userPt.x}, ${userPt.y})`}>
              <Circle cx={0} cy={0} r={42} fill={SHELTER_COLORS.user} fillOpacity={0.18} />
              <Circle cx={0} cy={0} r={22} fill={SHELTER_COLORS.user} fillOpacity={0.32} />
              <Circle cx={0} cy={0} r={11} fill={SHELTER_COLORS.user} stroke="#ffffff" strokeWidth={3} />
            </G>
          </Svg>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export const MapCanvas = memo(MapCanvasInner);
