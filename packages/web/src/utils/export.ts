import { Capacitor } from '@capacitor/core'

export async function exportXlsx(wb: any, filename: string) {
  const { write, writeFile } = await import('xlsx')

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')

    try {
      // Generate base64 representation of the workbook
      const b64 = write(wb, { type: 'base64', bookType: 'xlsx' })

      // Write to a temporary file
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: b64,
        directory: Directory.Cache,
      })

      // Share the file
      await Share.share({
        title: filename,
        text: filename,
        url: fileResult.uri,
        dialogTitle: `Export ${filename}`,
      })
    } catch (error) {
      console.error('Failed to export and share XLSX file:', error)
      throw error;
    }
  } else {
    // Normal web browser download
    writeFile(wb, filename)
  }
}
