export type Theater = {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
  bbox: [number, number, number, number];
};

export const THEATERS: Theater[] = [
  { id: "world", name: "World", center: [20, 12], zoom: 2.35, bbox: [-60, -180, 80, 180] },
  { id: "hormuz", name: "Hormuz", center: [26.55, 56.25], zoom: 7, bbox: [23.5, 53.5, 28.6, 59.2] },
  { id: "levant", name: "Levant", center: [32.8, 35.4], zoom: 6.2, bbox: [29.4, 32.0, 37.5, 39.5] },
  { id: "ukraine", name: "Ukraine", center: [48.5, 32.5], zoom: 5.6, bbox: [44.0, 22.0, 53.5, 42.5] },
  { id: "redsea", name: "Red Sea", center: [15.3, 42.5], zoom: 5.8, bbox: [10.5, 38.5, 22.5, 48.0] },
  { id: "taiwan", name: "Taiwan", center: [23.7, 121.0], zoom: 6.4, bbox: [20.5, 117.0, 27.2, 125.5] },
  { id: "korea", name: "Korea", center: [38.3, 127.2], zoom: 6.2, bbox: [33.0, 123.5, 43.0, 132.5] },
  { id: "caucasus", name: "Caucasus", center: [41.5, 45.0], zoom: 6, bbox: [38.0, 40.0, 44.8, 50.5] },
  { id: "baltic", name: "Baltic", center: [57.5, 20.5], zoom: 5.4, bbox: [53.5, 10.0, 66.0, 32.0] },
  { id: "sahel", name: "Sahel", center: [16.0, 8.0], zoom: 4.6, bbox: [8.0, -18.0, 24.0, 24.0] },
];
