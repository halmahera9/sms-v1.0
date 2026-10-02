'use client';

import React, { useState, useEffect } from 'react';
import {
  getStudentsAction,
  saveStudentAction,
  StudentRecordDTO,
  SaveStudentDTO,
} from '@/platform/actions/student';
import {
  getOCRDocumentsAction,
  uploadOCRDocumentAction,
  verifyExtractedItemAction,
  OCRDocumentDTO,
  ExtractedItemDTO,
} from '@/platform/actions/student-workflow';
import { StudentStatus } from '@prisma/client';
import {
  Users,
  ScanText,
  CheckSquare,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  Upload,
  Download,
  Plus,
  Edit2,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { getStudentAbsenceExportDataAction } from '@/platform/actions/student-export';
import { mapDtoRowsToExportRows, downloadStudentAbsenceExcel } from '../export';

export const StudentWorkspace: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'students' | 'ocr' | 'verify' | 'export'>('students');
  const [students, setStudents] = useState<StudentRecordDTO[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(true);
  const [studentError, setStudentError] = useState<string | null>(null);

  // Modal / Form state for Create/Edit Student
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecordDTO | null>(null);
  const [formData, setFormData] = useState<SaveStudentDTO>({
    nisn: '',
    nis: '',
    fullName: '',
    className: '',
    status: StudentStatus.ACTIVE,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // OCR Documents State (PostgreSQL Server-backed)
  const [documents, setDocuments] = useState<OCRDocumentDTO[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [docError, setDocError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  type StudentSortKey = 'nisn' | 'nis' | 'fullName' | 'className' | 'status';

  const [studentPageSize, setStudentPageSize] = useState<50 | 100 | 'all'>(50);
  const [studentCurrentPage, setStudentCurrentPage] = useState(1);
  const [studentSortKey, setStudentSortKey] = useState<StudentSortKey>('fullName');
  const [studentSortDirection, setStudentSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [uploadResultDoc, setUploadResultDoc] = useState<OCRDocumentDTO | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [verifyingItemId, setVerifyingItemId] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    setStudentError(null);
    try {
      const res = await getStudentsAction({ limit: 'all' });
      if (res.success && res.data) {
        setStudents(res.data);
      } else {
        setStudentError(res.error?.message || 'Gagal memuat master data siswa dari server.');
      }
    } catch {
      setStudentError('Terjadi kesalahan saat menghubungi server.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    setDocError(null);
    try {
      const res = await getOCRDocumentsAction();
      if (res.success && res.data) {
        setDocuments(res.data);
        if (res.data.length > 0 && !selectedDocId) {
          setSelectedDocId(res.data[0].id);
        }
      } else {
        setDocError(res.error?.message || 'Gagal memuat data dokumen OCR dari server.');
      }
    } catch {
      setDocError('Terjadi kesalahan saat memuat dokumen OCR.');
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchDocuments();
  }, []);

  const filteredStudents = students
    .filter(
      (s) =>
        !searchTerm ||
        s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nisn.includes(searchTerm) ||
        s.nis.includes(searchTerm) ||
        s.className.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = String(a[studentSortKey] ?? '');
      const bValue = String(b[studentSortKey] ?? '');

      const comparison = aValue.localeCompare(bValue, 'id', {
        numeric: true,
        sensitivity: 'base',
      });

      return studentSortDirection === 'asc' ? comparison : -comparison;
    });

  const studentTotalPages =
    studentPageSize === 'all'
      ? 1
      : Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));

  const safeStudentPage = Math.min(studentCurrentPage, studentTotalPages);

  const displayedStudents =
    studentPageSize === 'all'
      ? filteredStudents
      : filteredStudents.slice(
          (safeStudentPage - 1) * studentPageSize,
          safeStudentPage * studentPageSize
        );

  const handleStudentSort = (key: StudentSortKey) => {
    if (studentSortKey === key) {
      setStudentSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setStudentSortKey(key);
    setStudentSortDirection('asc');
  };

  const handleStudentPageSize = (size: 50 | 100 | 'all') => {
    setStudentPageSize(size);
    setStudentCurrentPage(1);
  };

  const currentDoc = documents.find((d) => d.id === selectedDocId) || (documents.length > 0 ? documents[0] : null);

  const handleOpenCreateModal = () => {
    setEditingStudent(null);
    setFormData({
      nisn: '',
      nis: '',
      fullName: '',
      className: '',
      status: StudentStatus.ACTIVE,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (student: StudentRecordDTO) => {
    setEditingStudent(student);
    setFormData({
      id: student.id,
      nisn: student.nisn,
      nis: student.nis,
      fullName: student.fullName,
      className: student.className,
      status: student.status,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setFormError(null);

    try {
      const res = await saveStudentAction(formData);
      if (res.success && res.data) {
        setIsModalOpen(false);
        await fetchStudents();
      } else {
        setFormError(res.error?.message || 'Gagal menyimpan data siswa.');
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan saat menyimpan data siswa.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyItem = async (itemId: string) => {
    if (verifyingItemId) return;
    setVerifyingItemId(itemId);

    try {
      const res = await verifyExtractedItemAction({ itemId });
      if (res.success) {
        await fetchDocuments();
      } else {
        alert(res.error?.message || 'Gagal memverifikasi item ekstraksi.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan saat memverifikasi item.');
    } finally {
      setVerifyingItemId(null);
    }
  };

  const handleSimulateOCRUpload = async () => {
    if (isUploading) return;
    setIsUploading(true);

    const timestamp = Date.now();
    const payload = {
      fileName: `Surat_Izin_Ketidakhadiran_${timestamp.toString().slice(-4)}.png`,
      fileSize: 1024 * 520,
      imageUrl: '/placeholder-doc.png',
      items: [
        {
          ocrText: 'Citra Dewi - X IPA 1 - Sakit flu berat',
          matchedStudentName: 'Citra Dewi',
          matchedNisn: '0051234569',
          confidence: 92,
          class: 'X IPA 1',
          date: new Date().toISOString().slice(0, 10),
          status: 'Sakit' as const,
          notes: 'Flu dan demam 2 hari',
        },
        {
          ocrText: 'Dewi L - X IPA 2 - Izin acara',
          matchedStudentName: 'Dewi Lestari',
          matchedNisn: '0051234570',
          confidence: 68,
          class: 'X IPA 2',
          date: new Date().toISOString().slice(0, 10),
          status: 'Izin' as const,
          notes: 'Izin urusan keluarga',
        },
      ],
    };

    try {
      const res = await uploadOCRDocumentAction(payload);
      if (res.success && res.data) {
        setUploadResultDoc(res.data);
        setSelectedDocId(res.data.id);
        await fetchDocuments();
      } else {
        alert(res.error?.message || 'Gagal mengunggah dokumen OCR.');
      }
    } catch {
      alert('Terjadi kesalahan saat memproses unggahan OCR.');
    } finally {
      setIsUploading(false);
    }
  };

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const res = await getStudentAbsenceExportDataAction({ selectedClass: 'Semua' });
      if (res.success && res.data && res.data.rows.length > 0) {
        const exportRows = mapDtoRowsToExportRows(res.data.rows);
        const success = downloadStudentAbsenceExcel(exportRows, res.data.filename);
        if (!success) {
          alert('Gagal membuat file Excel.');
        }
      } else {
        alert('Tidak ada data terverifikasi untuk diekspor. Selesaikan verifikasi manual terlebih dahulu.');
      }
    } catch {
      alert('Terjadi kesalahan saat mengekspor data Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Workspace Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-6 rounded-2xl border border-blue-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border border-blue-100/80 bg-blue-100/30" />
        <div className="absolute right-12 -bottom-20 h-36 w-36 rounded-full border border-cyan-100/80 bg-cyan-100/30" />
        <div className="absolute right-24 top-8 h-2 w-2 rounded-full bg-cyan-300" />

        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 bg-white/80 text-blue-700 border border-blue-100 px-3 py-1 rounded-full text-xs font-medium mb-3 shadow-sm">
            <Users className="w-3.5 h-3.5" />
            <span>Student Administration Domain Module</span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Master Data Siswa
          </h1>

          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Pengelolaan data siswa sekolah, ekstraksi OCR dokumen izin/sakit,
            dan antrean verifikasi ketidakhadiran dalam satu ruang kerja.
          </p>
        </div>

        <div className="relative z-10 flex items-center space-x-2">
          <button
            onClick={handleSimulateOCRUpload}
            disabled={isUploading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-sm flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{isUploading ? 'Memproses OCR...' : 'Upload OCR Baru'}</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: MASTER DATA SISWA */}
      {activeSubTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200  shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cari nama, NISN, NIS, atau kelas..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setStudentCurrentPage(1);
                }}
                className="w-full bg-slate-50  border border-slate-200  pl-9 pr-4 py-2 rounded-lg text-xs text-slate-900 "
              />
            </div>
            <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-xs text-slate-500">
                Menampilkan {displayedStudents.length} dari {filteredStudents.length} siswa
              </span>
              <button
                onClick={handleOpenCreateModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1.5 transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Siswa</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Tampilkan</span>

              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {[50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handleStudentPageSize(size as 50 | 100)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      studentPageSize === size
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {size}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => handleStudentPageSize('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    studentPageSize === 'all'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Semua
                </button>
              </div>
            </div>
          </div>

          {/* Student Error Banner */}
          {studentError && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex items-center justify-between text-rose-800 dark:text-rose-200 text-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{studentError}</span>
              </div>
              <button
                onClick={fetchStudents}
                className="bg-rose-100 dark:bg-rose-900 hover:bg-rose-200 text-rose-800 dark:text-rose-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          )}

          {/* Loading State */}
          {loadingStudents ? (
            <div className="bg-white rounded-2xl border border-slate-200  shadow-sm p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-mono">Memuat Master Data Siswa dari Server PostgreSQL...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200  shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-[10px] font-medium tracking-[0.04em] text-slate-500 uppercase">
  <tr>
    <th className="py-3 px-4 w-12">No</th>

    <th className="py-3 px-4">
      <button
        type="button"
        onClick={() => handleStudentSort('nisn')}
        className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
      >
        NISN
        {studentSortKey === 'nisn' ? (
          studentSortDirection === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-600" />
            : <ChevronDown className="w-3 h-3 text-blue-600" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300" />
        )}
      </button>
    </th>

    <th className="py-3 px-4">
      <button
        type="button"
        onClick={() => handleStudentSort('nis')}
        className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
      >
        NIS
        {studentSortKey === 'nis' ? (
          studentSortDirection === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-600" />
            : <ChevronDown className="w-3 h-3 text-blue-600" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300" />
        )}
      </button>
    </th>

    <th className="py-3 px-4">
      <button
        type="button"
        onClick={() => handleStudentSort('fullName')}
        className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
      >
        Nama Siswa
        {studentSortKey === 'fullName' ? (
          studentSortDirection === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-600" />
            : <ChevronDown className="w-3 h-3 text-blue-600" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300" />
        )}
      </button>
    </th>

    <th className="py-3 px-4">
      <button
        type="button"
        onClick={() => handleStudentSort('className')}
        className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
      >
        Kelas
        {studentSortKey === 'className' ? (
          studentSortDirection === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-600" />
            : <ChevronDown className="w-3 h-3 text-blue-600" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300" />
        )}
      </button>
    </th>

    <th className="py-3 px-4">
      <button
        type="button"
        onClick={() => handleStudentSort('status')}
        className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors"
      >
        Status
        {studentSortKey === 'status' ? (
          studentSortDirection === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-600" />
            : <ChevronDown className="w-3 h-3 text-blue-600" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300" />
        )}
      </button>
    </th>

    <th className="py-3 px-4 text-right">Aksi</th>
  </tr>
</thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {displayedStudents.length > 0 ? (
                    displayedStudents.map((std, idx) => (
                      <tr key={std.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="py-3 px-4 text-xs font-normal text-slate-400">
                          {(safeStudentPage - 1) * (studentPageSize === 'all' ? filteredStudents.length : studentPageSize) + idx + 1}
                        </td>
                        <td className="py-3 px-4 text-xs font-normal text-slate-600">
                          <span className="font-mono">{std.nisn}</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-normal text-slate-600">
                          <span className="font-mono">{std.nis}</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-normal text-slate-700">
                          {std.fullName}
                        </td>
                        <td className="py-3 px-4 text-xs font-normal text-slate-600">
                          {std.className}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                              std.status === 'ACTIVE'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {std.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenEditModal(std)}
                            className="text-blue-600 hover:text-blue-700 hover:underline font-normal text-xs inline-flex items-center space-x-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Tidak ada data siswa yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 px-4 py-3 bg-white">
                <div className="text-xs text-slate-400">
                  Menampilkan
                  <span className="mx-1 font-medium text-slate-600">
                    {filteredStudents.length === 0 ? 0 : (safeStudentPage - 1) * (studentPageSize === 'all' ? filteredStudents.length : studentPageSize) + 1}
                  </span>
                  –
                  <span className="mx-1 font-medium text-slate-600">
                    {Math.min(
                      safeStudentPage * (studentPageSize === 'all' ? filteredStudents.length : studentPageSize),
                      filteredStudents.length
                    )}
                  </span>
                  dari
                  <span className="mx-1 font-medium text-slate-600">
                    {filteredStudents.length}
                  </span>
                  siswa
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="mr-1 text-xs text-slate-400">Tampilkan</span>

                    {[50, 100].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleStudentPageSize(size as 50 | 100)}
                        className={`min-w-8 px-2.5 py-1.5 rounded-lg text-xs font-normal transition-colors ${
                          studentPageSize === size
                            ? 'bg-blue-50 text-blue-600 border border-blue-200'
                            : 'text-slate-500 border border-transparent hover:bg-slate-50'
                        }`}
                      >
                        {size}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => handleStudentPageSize('all')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-normal transition-colors ${
                        studentPageSize === 'all'
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'text-slate-500 border border-transparent hover:bg-slate-50'
                      }`}
                    >
                      Semua
                    </button>
                  </div>

                  {studentPageSize !== 'all' && studentTotalPages > 1 && (
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                      <button
                        type="button"
                        disabled={safeStudentPage === 1}
                        onClick={() => setStudentCurrentPage((page) => Math.max(1, page - 1))}
                        className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50"
                      >
                        ‹
                      </button>

                      {Array.from({ length: studentTotalPages }, (_, index) => index + 1).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setStudentCurrentPage(page)}
                          className={`h-8 min-w-8 rounded-lg px-2 text-xs font-normal ${
                            safeStudentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={safeStudentPage === studentTotalPages}
                        onClick={() => setStudentCurrentPage((page) => Math.min(studentTotalPages, page + 1))}
                        className="h-8 w-8 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ANTREAN VERIFIKASI OCR */}
      {activeSubTab === 'verify' && (
        <div className="space-y-4">
          {loadingDocs ? (
            <div className="bg-white rounded-2xl border border-slate-200  shadow-sm p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-mono">Memuat Antrean Verifikasi OCR dari Server...</p>
            </div>
          ) : currentDoc ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200  shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100  pb-3">
                <div>
                  <h3 className="font-bold text-slate-900  text-sm">
                    {currentDoc.fileName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Status: <span className="font-bold text-amber-600">{currentDoc.status}</span> | Terverifikasi: {currentDoc.verifiedCount}/{currentDoc.extractedCount} item
                  </p>
                </div>

                {documents.length > 1 && (
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="bg-slate-50  border border-slate-200  px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fileName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-3">
                {currentDoc.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50 /60 rounded-2xl border border-slate-200  flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900 ">
                          {idx + 1}. {item.matchedStudentName || item.ocrText}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            item.confidence >= 70
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          Akurasi OCR: {item.confidence}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Kelas: {item.class} | Status: <span className="font-bold text-blue-600">{item.status}</span> | Catatan: {item.notes || '-'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {item.verificationStatus !== 'verified' ? (
                        <button
                          onClick={() => handleVerifyItem(item.id)}
                          disabled={verifyingItemId === item.id}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold shadow-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          {verifyingItemId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>{verifyingItemId === item.id ? 'Memverifikasi...' : 'Verifikasi Manual ✓'}</span>
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg">
                          Terverifikasi ✓
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">Belum ada dokumen OCR terdaftar.</p>
          )}
        </div>
      )}

      {/* SUB-TAB 3: DOKUMEN OCR LIST */}
      {activeSubTab === 'ocr' && (
        <div className="bg-white rounded-2xl border border-slate-200  shadow-sm overflow-hidden">
          {loadingDocs ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-mono">Memuat Dokumen OCR dari Server...</p>
            </div>
          ) : (
            <table className="w-full text-left text-[12px] font-sans">
              <thead className="bg-slate-50  text-[11px] font-bold text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">Nama File</th>
                  <th className="py-3 px-4">Tanggal Upload</th>
                  <th className="py-3 px-4">Ekstraksi</th>
                  <th className="py-3 px-4">Terverifikasi</th>
                  <th className="py-3 px-4">Status Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {documents.length > 0 ? (
                  documents.map((d) => (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-50 ${selectedDocId === d.id ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900  flex items-center space-x-2">
                        <span>{d.fileName}</span>
                        {selectedDocId === d.id && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Dipilih</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {new Date(d.uploadedAt).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 font-bold text-blue-600">{d.extractedCount} item</td>
                      <td className="py-3 px-4 font-bold text-blue-600">{d.verifiedCount} item</td>
                      <td className="py-3 px-4">
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada dokumen OCR terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* SUB-TAB 4: EXPORT REKAP EXCEL */}
      {activeSubTab === 'export' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200  shadow-sm space-y-4 max-w-xl mx-auto text-center">
          <FileSpreadsheet className="w-12 h-12 text-blue-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 ">
            Export Rekap Ketidakhadiran Siswa (.xlsx)
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Unduh seluruh data hasil verifikasi ketidakhadiran siswa dalam format file Excel Spreadsheet resmi.
          </p>

          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg flex items-center space-x-2 mx-auto transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExporting ? 'Mengekspor...' : 'Download Rekap Excel'}</span>
          </button>
        </div>
      )}

      {/* Create / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200  shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100  pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900  text-base">
                  {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudentSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700  font-bold mb-1">
                    NISN (10 Digit) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="Contoh: 0051234567"
                    value={formData.nisn}
                    onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                    className="w-full bg-slate-50  border border-slate-200  px-3 py-2 rounded-lg text-slate-900  font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700  font-bold mb-1">
                    NIS (Nomor Induk Siswa) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    placeholder="Contoh: 21221001"
                    value={formData.nis}
                    onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                    className="w-full bg-slate-50  border border-slate-200  px-3 py-2 rounded-lg text-slate-900  font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700  font-bold mb-1">
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap sesuai Dapodik"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-slate-50  border border-slate-200  px-3 py-2 rounded-lg text-slate-900 "
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700  font-bold mb-1">
                    Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: X IPA 1"
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    className="w-full bg-slate-50  border border-slate-200  px-3 py-2 rounded-lg text-slate-900 "
                  />
                </div>
                
              </div>

              <div>
                <label className="block text-slate-700  font-bold mb-1">
                  Status Siswa
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
                  className="w-full bg-slate-50  border border-slate-200  px-3 py-2 rounded-lg text-slate-900 "
                >
                  <option value={StudentStatus.ACTIVE}>ACTIVE (Aktif)</option>
                  <option value={StudentStatus.GRADUATED}>GRADUATED (Lulus)</option>
                  <option value={StudentStatus.TRANSFERRED}>TRANSFERRED (Pindah)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 ">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100  hover:bg-slate-200 text-slate-700  font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Data'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Processing Result Modal */}
      {uploadResultDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200  shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-100  pb-3">
              <div className="p-3 bg-blue-50 text-blue-400 rounded-xl border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900  text-base">Dokumen Berhasil Diproses</h3>
                <p className="text-xs text-slate-400 font-mono">{uploadResultDoc.fileName}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-50  p-3 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hasil Ekstraksi OCR:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {uploadResultDoc.extractedCount} Item Ditemukan
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Perlu Verifikasi:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {uploadResultDoc.extractedCount - uploadResultDoc.verifiedCount} Item
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Dokumen:</span>
                  <span className="font-mono font-bold text-slate-800 ">
                    {uploadResultDoc.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedDocId(uploadResultDoc.id);
                  setActiveSubTab('verify');
                  setUploadResultDoc(null);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-2.5 rounded-lg font-semibold shadow-sm flex items-center justify-center space-x-2"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Verifikasi Sekarang</span>
              </button>

              <button
                onClick={() => {
                  setSelectedDocId(uploadResultDoc.id);
                  setActiveSubTab('ocr');
                  setUploadResultDoc(null);
                }}
                className="w-full bg-slate-100  hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800  text-xs py-2.5 rounded-lg font-bold flex items-center justify-center space-x-2"
              >
                <ScanText className="w-4 h-4" />
                <span>Lihat Dokumen OCR</span>
              </button>

              <button
                onClick={() => setUploadResultDoc(null)}
                className="w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs py-1.5 font-medium text-center"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
