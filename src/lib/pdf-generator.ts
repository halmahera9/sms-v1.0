import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AwardProposal, SignatoryConfig } from '@/types/award';

export function generateNominatifPDF(proposals: AwardProposal[], config: SignatoryConfig): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Title & Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DAFTAR NOMINATIF USULAN PENGHARGAAN PEGAWAI', 148, 15, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(`PEMERINTAH PROVINSI DKI JAKARTA - SURAT EDARAN NO ${config.seNumber}`, 148, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Tanggal: ${config.seDate} | Total Entri: ${proposals.length} Pegawai`, 148, 27, { align: 'center' });

  // Table Data
  const tableData = proposals.map((p, idx) => [
    idx + 1,
    p.employee.nrk,
    p.employee.nip,
    p.employee.nama + (p.employee.gelar ? `, ${p.employee.gelar}` : ''),
    p.employee.jabatan,
    p.employee.ukpd,
    p.employee.wilayah,
    p.jenisPenghargaan === 'MASA_KERJA' ? `Masa Kerja (${p.nilaiUsulan} Thn)` : `Satyalancana (${p.nilaiUsulan})`,
    p.status,
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['No', 'NRK', 'NIP', 'Nama Pegawai', 'Jabatan', 'UKPD', 'Wilayah', 'Usulan', 'Status']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [243, 244, 246] },
  });

  // Footer / Signatory
  const docWithTable = doc as unknown as { lastAutoTable?: { finalY?: number } };
  const finalY = docWithTable.lastAutoTable?.finalY || 150;
  if (finalY + 40 < 200) {
    doc.setFontSize(9);
    doc.text('Mengetahui,', 220, finalY + 15);
    doc.text(config.officialSignatoryTitle, 220, finalY + 20);
    doc.setFont('helvetica', 'bold');
    doc.text(config.officialSignatoryName, 220, finalY + 38);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${config.officialSignatoryNip}`, 220, finalY + 43);
  }

  doc.save(`Daftar_Nominatif_Penghargaan_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateSingleProposalPDF(proposal: AwardProposal, config: SignatoryConfig): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header Letterhead
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PEMERINTAH PROVINSI DKI JAKARTA', 105, 15, { align: 'center' });
  doc.setFontSize(14);
  doc.text('BADAN KEPEGAWAIAN DAERAH', 105, 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Jalan Medan Merdeka Selatan No. 8-9 Blok H Lantai 19 Jakarta Pusat', 105, 27, { align: 'center' });
  doc.line(15, 30, 195, 30);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LEMBAR REKOMENDASI PENGUSULAN PENGHARGAAN PEGAWAI', 105, 38, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor Verifikasi: VERIF/${proposal.employee.nrk}/${new Date().getFullYear()}`, 105, 43, { align: 'center' });

  // Employee Detail Table
  autoTable(doc, {
    startY: 48,
    body: [
      ['Nama Lengkap', `: ${proposal.employee.nama} ${proposal.employee.gelar || ''}`],
      ['NRK / NIP', `: ${proposal.employee.nrk} / ${proposal.employee.nip}`],
      ['Pangkat / Gol. Ruang', `: ${proposal.employee.pangkat || '-'}`],
      ['Jabatan', `: ${proposal.employee.jabatan}`],
      ['Unit Kerja / UKPD', `: ${proposal.employee.unitKerja}`],
      ['Perangkat Daerah', `: ${proposal.employee.perangkatDaerah}`],
      ['Wilayah Kota/Kab', `: ${proposal.employee.wilayah}`],
      ['Jenis Penghargaan', `: ${proposal.jenisPenghargaan === 'MASA_KERJA' ? 'Penghargaan Masa Kerja' : 'Satyalancana Karya Satya'}`],
      ['Nilai Usulan', `: ${proposal.nilaiUsulan}`],
      ['Status Verifikasi', `: ${proposal.status} (BERKAS LENGKAP)`],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 130 } },
  });

  const tableY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 120;

  // Notes
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Catatan Verifikasi Berkas:', 15, tableY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(proposal.catatan || 'Seluruh dokumen persyaratan utama telah diverifikasi sesuai SE Kepala BKD DKI Jakarta.', 15, tableY + 14);

  // Signatures
  doc.text('Jakarta, ' + config.seDate, 130, tableY + 30);
  doc.text(config.bkdHeadTitle, 130, tableY + 35);
  doc.setFont('helvetica', 'bold');
  doc.text(config.bkdHeadName, 130, tableY + 60);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${config.bkdHeadNip}`, 130, tableY + 65);

  doc.save(`Rekomendasi_${proposal.employee.nrk}_${proposal.jenisPenghargaan}.pdf`);
}
