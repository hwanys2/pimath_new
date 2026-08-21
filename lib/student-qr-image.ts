import QRCode from "qrcode";

const QR_DARK = "#5b3d29";
const QR_LIGHT = "#ffffff";

export async function qrDataUrl(url: string, width = 512): Promise<string> {
  return QRCode.toDataURL(url, {
    width,
    margin: 1,
    color: { dark: QR_DARK, light: QR_LIGHT },
  });
}
