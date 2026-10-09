/** Shared display names; stage timing and crop-model parameters remain in CropPack. */
export const GROWTH_STAGES = {
  vegetative: { zh: '营养生长期', en: 'Vegetative' },
  flowering: { zh: '开花期', en: 'Flowering' },
  fruit_set: { zh: '坐果期', en: 'Fruit set' },
  ripening: { zh: '转熟期', en: 'Ripening' },
  harvest: { zh: '采收期', en: 'Harvest' },
};

export const GROWTH_STAGE_LABELS = Object.fromEntries(Object.entries(GROWTH_STAGES).map(([id, names]) => [id, names.zh]));
