import { Capacitor } from '@capacitor/core'

export interface SetlistExportColumn {
  key: 'title' | 'artist' | 'bpm' | 'tuning' | 'pitch' | 'notes' | 'length'
  label: string
}

export interface SetlistExportItem {
  id: number
  title: string
  artist: string
  type: string // 'song' | 'set' | 'pause' | 'encore' | 'tuning' | 'note'
  bpm?: number | null
  pitch?: number | null
  notes?: string | null
  lengthMs?: number | null
  tuning?: string | null
  personalNote?: string | null
}

export interface SetlistExportData {
  bandName: string
  gigTitle: string
  gigDate?: string | null
  gigTime?: string | null
  gigLocation?: string | null
  gigNotes?: string | null
  totalDurationMs?: number | null
  columns: SetlistExportColumn[]
  items: SetlistExportItem[]
}

export function isShareCancellation(error: any): boolean {
  if (!error) return false
  const msg = (error.message || error.toString() || '').toLowerCase()
  return error.name === 'AbortError' || msg.includes('cancel') || msg.includes('abort')
}

async function saveOrShareFile(filename: string, base64Data: string, blob: Blob): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')

    try {
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      })

      await Share.share({
        title: filename,
        text: filename,
        url: fileResult.uri,
        dialogTitle: `Export ${filename}`,
      })
      return true
    } catch (error) {
      if (isShareCancellation(error)) {
        return false
      }
      console.error(`Failed to export and share ${filename}:`, error)
      throw error
    }
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  }
}

export async function exportXlsx(wb: any, filename: string): Promise<boolean> {
  const { write, writeFile } = await import('xlsx')

  if (Capacitor.isNativePlatform()) {
    const b64 = write(wb, { type: 'base64', bookType: 'xlsx' })
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    try {
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: b64,
        directory: Directory.Cache,
      })
      await Share.share({
        title: filename,
        text: filename,
        url: fileResult.uri,
        dialogTitle: `Export ${filename}`,
      })
      return true
    } catch (error) {
      if (isShareCancellation(error)) {
        return false
      }
      console.error(`Failed to export and share ${filename}:`, error)
      throw error
    }
  } else {
    writeFile(wb, filename)
    return true
  }
}

export function formatDuration(ms: number): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '0:00'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatTotalDuration(ms: number): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '00:00:00'
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatPitch(pitch: number | null | undefined): string {
  if (typeof pitch !== 'number' || pitch === 0) return '-'
  return (pitch > 0 ? '+' : '') + pitch
}

export async function exportPdf(data: SetlistExportData, filename: string): Promise<boolean> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const totalSongs = data.items.filter((i) => i.type === 'song').length
  const totalDurationMs = typeof data.totalDurationMs === 'number'
    ? data.totalDurationMs
    : data.items
        .filter((i) => i.type === 'song' && typeof i.lengthMs === 'number')
        .reduce((sum, i) => sum + (i.lengthMs ?? 0), 0)
  const totalDurationStr = formatTotalDuration(totalDurationMs)

  // Header
  let currentY = 18

  // Band Name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(33, 33, 33)
  doc.text(data.bandName || 'Bandstr', 14, currentY)
  currentY += 8

  // Gig Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(55, 71, 79)
  doc.text(data.gigTitle, 14, currentY)
  currentY += 6

  // Details row (Date, Time, Location, Songs, Duration)
  const metaParts: string[] = []
  if (data.gigDate) metaParts.push(`Datum: ${data.gigDate}`)
  if (data.gigTime) metaParts.push(`Uhrzeit: ${data.gigTime}`)
  if (data.gigLocation) metaParts.push(`Ort: ${data.gigLocation}`)
  metaParts.push(`Songs: ${totalSongs}`)
  if (totalDurationMs > 0) metaParts.push(`Gesamtdauer: ${totalDurationStr}`)

  if (metaParts.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(117, 117, 117)
    doc.text(metaParts.join('   |   '), 14, currentY)
    currentY += 5
  }

  if (data.gigNotes) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(130, 130, 130)
    doc.text(data.gigNotes, 14, currentY)
    currentY += 5
  }

  currentY += 4

  // Table Columns
  const tableHeaders: string[] = ['#']
  data.columns.forEach((col) => tableHeaders.push(col.label))

  // Build rows with sections (SET 1, PAUSE, ZUGABE, etc.)
  const tableRows: any[][] = []
  let songIndex = 1

  data.items.forEach((item) => {
    if (item.type === 'set' || item.type === 'pause' || item.type === 'encore') {
      const bannerText = item.title.toUpperCase()
      // Full row span banner
      const bannerRow = [
        {
          content: bannerText,
          colSpan: tableHeaders.length,
          styles: {
            halign: 'center',
            fillColor: item.type === 'pause' ? [238, 238, 238] : [44, 62, 80],
            textColor: item.type === 'pause' ? [66, 66, 66] : [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11,
          },
        },
      ]
      tableRows.push(bannerRow)
    } else if (item.type === 'tuning' || item.type === 'note') {
      const noteRow = [
        {
          content: `${item.title}${item.notes ? ` — ${item.notes}` : ''}`,
          colSpan: tableHeaders.length,
          styles: {
            fontStyle: 'italic',
            fillColor: [248, 249, 250],
            textColor: [100, 100, 100],
            fontSize: 9,
          },
        },
      ]
      tableRows.push(noteRow)
    } else {
      // Regular song
      const row: any[] = [songIndex++]
      data.columns.forEach((col) => {
        if (col.key === 'title') row.push(item.title)
        else if (col.key === 'artist') row.push(item.artist || '')
        else if (col.key === 'bpm') row.push(item.bpm ? String(item.bpm) : '-')
        else if (col.key === 'tuning') row.push(item.tuning || item.title.includes('Tuning') ? item.title : '-')
        else if (col.key === 'pitch') row.push(formatPitch(item.pitch))
        else if (col.key === 'notes') row.push(item.notes || item.personalNote || '-')
        else if (col.key === 'length') row.push(item.lengthMs ? formatDuration(item.lengthMs) : '-')
        else row.push('-')
      })
      tableRows.push(row)
    }
  })

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 9.5,
      cellPadding: 2.5,
      lineColor: [220, 224, 230],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [33, 43, 54],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [250, 251, 252],
    },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: (hookData) => {
      // Left side: Total Songs & Duration
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Total Songs: ${totalSongs}   |   Total Duration: ${totalDurationStr}`, 14, doc.internal.pageSize.getHeight() - 8)

      // Right side: Page number in footer
      const str = `Seite ${hookData.pageNumber}`
      doc.text(str, doc.internal.pageSize.getWidth() - 25, doc.internal.pageSize.getHeight() - 8)
    },
  })

  const pdfArrayBuffer = doc.output('arraybuffer')
  const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' })
  const base64 = doc.output('datauristring').split(',')[1] || ''
  return await saveOrShareFile(filename, base64, blob)
}

export async function exportDocx(data: SetlistExportData, filename: string): Promise<boolean> {
  const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    HeadingLevel,
    AlignmentType,
    WidthType,
    ShadingType,
    BorderStyle,
  } = await import('docx')

  const totalSongs = data.items.filter((i) => i.type === 'song').length
  const totalDurationMs = typeof data.totalDurationMs === 'number'
    ? data.totalDurationMs
    : data.items
        .filter((i) => i.type === 'song' && typeof i.lengthMs === 'number')
        .reduce((sum, i) => sum + (i.lengthMs ?? 0), 0)
  const totalDurationStr = formatTotalDuration(totalDurationMs)

  const children: any[] = []

  // Document Title (Band Name)
  children.push(
    new Paragraph({
      text: data.bandName || 'Bandstr',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
  )

  // Gig Title
  children.push(
    new Paragraph({
      text: data.gigTitle,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
  )

  // Gig Details Subtitle (Date, Time, Location, Songs, Duration)
  const metaParts: string[] = []
  if (data.gigDate) metaParts.push(`Datum: ${data.gigDate}`)
  if (data.gigTime) metaParts.push(`Uhrzeit: ${data.gigTime}`)
  if (data.gigLocation) metaParts.push(`Ort: ${data.gigLocation}`)
  metaParts.push(`Songs: ${totalSongs}`)
  if (totalDurationMs > 0) metaParts.push(`Gesamtdauer: ${totalDurationStr}`)

  if (metaParts.length) {
    children.push(
      new Paragraph({
        text: metaParts.join('   |   '),
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
    )
  }

  if (data.gigNotes) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: data.gigNotes, italics: true, color: '666666' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    )
  }

  // Build Table
  const tableRows: any[] = []

  // Header Row
  const headerCells = [
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'FFFFFF' })] })],
      shading: { fill: '2C3E50', type: ShadingType.CLEAR, color: 'auto' },
      width: { size: 8, type: WidthType.PERCENTAGE },
    }),
  ]

  const remainingPercent = 92
  const colPercent = Math.floor(remainingPercent / Math.max(1, data.columns.length))

  data.columns.forEach((col) => {
    headerCells.push(
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: col.label, bold: true, color: 'FFFFFF' })] })],
        shading: { fill: '2C3E50', type: ShadingType.CLEAR, color: 'auto' },
        width: { size: colPercent, type: WidthType.PERCENTAGE },
      }),
    )
  })

  tableRows.push(new TableRow({ children: headerCells, tableHeader: true }))

  let songIndex = 1

  data.items.forEach((item) => {
    if (item.type === 'set' || item.type === 'pause' || item.type === 'encore') {
      const bannerText = item.title.toUpperCase()
      const isPause = item.type === 'pause'
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              columnSpan: headerCells.length,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: bannerText, bold: true, color: isPause ? '333333' : 'FFFFFF' })],
                }),
              ],
              shading: { fill: isPause ? 'E0E0E0' : '34495E', type: ShadingType.CLEAR, color: 'auto' },
            }),
          ],
        }),
      )
    } else if (item.type === 'tuning' || item.type === 'note') {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              columnSpan: headerCells.length,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${item.title}${item.notes ? ` — ${item.notes}` : ''}`,
                      italics: true,
                      color: '666666',
                    }),
                  ],
                }),
              ],
              shading: { fill: 'F9F9F9', type: ShadingType.CLEAR, color: 'auto' },
            }),
          ],
        }),
      )
    } else {
      const cells = [
        new TableCell({
          children: [new Paragraph({ text: String(songIndex++) })],
          width: { size: 8, type: WidthType.PERCENTAGE },
        }),
      ]

      data.columns.forEach((col) => {
        let val = '-'
        if (col.key === 'title') val = item.title
        else if (col.key === 'artist') val = item.artist || ''
        else if (col.key === 'bpm') val = item.bpm ? String(item.bpm) : '-'
        else if (col.key === 'tuning') val = item.tuning || item.title.includes('Tuning') ? item.title : '-'
        else if (col.key === 'pitch') val = formatPitch(item.pitch)
        else if (col.key === 'notes') val = item.notes || item.personalNote || '-'
        else if (col.key === 'length') val = item.lengthMs ? formatDuration(item.lengthMs) : '-'

        cells.push(
          new TableCell({
            children: [new Paragraph({ text: val })],
            width: { size: colPercent, type: WidthType.PERCENTAGE },
          }),
        )
      })

      tableRows.push(new TableRow({ children: cells }))
    }
  })

  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  })

  children.push(table)

  // Footer summary paragraph
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Total Songs: ${totalSongs}   |   Total Duration: ${totalDurationStr}`,
          color: '666666',
          size: 18,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 100 },
    }),
  )

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const base64 = await Packer.toBase64String(doc)
  return await saveOrShareFile(filename, base64, blob)
}
