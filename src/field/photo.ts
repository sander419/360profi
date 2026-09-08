// Подготовка снимка с телефона к отправке.
//
// Камера отдаёт 3-5 мегабайт на кадр. Такой файл не уйдёт через слабую связь на
// площадке и не поместится в очередь, поэтому ужимаем прямо в браузере: длинная
// сторона до 1280 px, JPEG. Поломку на таком снимке видно, а весит он ~150 КБ.

const MAX_SIDE = 1280;
const QUALITY = 0.7;

export interface PreparedPhoto {
  dataUrl: string;
  bytes: number;
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать снимок'));
    };
    image.src = url;
  });

export const preparePhoto = async (file: File): Promise<PreparedPhoto> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Это не изображение');
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Браузер не дал обработать снимок');
  context.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  // Длина base64 минус заголовок, с поправкой на кодирование 4:3.
  const bytes = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
  return { dataUrl, bytes };
};
