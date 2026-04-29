"use client";
import { useState, useEffect, Suspense } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../setlists.module.css";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { IKContext, IKUpload } from "imagekitio-react";
import { FaPlus, FaArrowUp, FaArrowDown, FaTrash, FaSearch, FaCalendarAlt, FaCheck, FaTimes, FaFilter, FaImage } from "react-icons/fa";
import SongViewer from "../../components/SongViewer";
import { AnimatePresence } from "framer-motion";

const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

function NewSetlistContent() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const editSetId = searchParams.get("editSetId");
    const initSongId = searchParams.get("songId");

    // Initial Filter Params
    const initQ = searchParams.get("q") || "";
    const initKey = searchParams.get("key") || "";
    const initLang = searchParams.get("lang") || "";
    const initCat = searchParams.get("cat") || "";

    const [allSongs, setAllSongs] = useState<any[]>([]);
    const [filteredSongs, setFilteredSongs] = useState<any[]>([]);

    const [search, setSearch] = useState(initQ);
    const [filterKey, setFilterKey] = useState(initKey);
    const [filterCategory, setFilterCategory] = useState(initCat);
    const [filterLanguage, setFilterLanguage] = useState(initLang);

    const [formData, setFormData] = useState({
        name: "",
        targetDate: new Date().toISOString().split('T')[0]
    });

    const [selectedSongs, setSelectedSongs] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Temp-song naming modal
    const [pendingUploadRes, setPendingUploadRes] = useState<any>(null);
    const [tempSongName, setTempSongName] = useState("");
    const [savingTemp, setSavingTemp] = useState(false);

    // Viewing state for preview
    const [viewingSong, setViewingSong] = useState<any>(null);
    const [showFilters, setShowFilters] = useState(false);

    const authenticator = async () => {
        try {
            const response = await fetch("/api/imagekit/auth");
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Request failed with status ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            const { signature, expire, token } = data;
            return { signature, expire, token };
        } catch (error: any) {
            throw new Error(`Authentication request failed: ${error.message}`);
        }
    };

    const handleUploadError = (err: any) => {
        setUploading(false);
        console.error("Upload Error", err);
        alert("이미지 업로드 실패");
    };

    const handleUploadSuccess = (res: any) => {
        setUploading(false);
        // Don't write to Firestore yet — show the naming modal first
        setPendingUploadRes(res);
        setTempSongName("");
    };

    const confirmTempSong = async () => {
        if (!pendingUploadRes) return;
        setSavingTemp(true);
        try {
            const name = tempSongName.trim() || "새 악보 (업로드됨)";
            const tempSongData = {
                songName: name,
                songArtist: "Unknown",
                songKey: "-",
                songCategory: "-",
                songArrangedBy: "-",
                songBpm: "-",
                songLanguage: "-",
                imageUrl: pendingUploadRes.url,
                thumbnailUrl: pendingUploadRes.thumbnailUrl || pendingUploadRes.url,
                filePath: pendingUploadRes.filePath,
                imageIds: [pendingUploadRes.fileId],
                uploadedBy: user?.uid,
                createdAt: new Date(),
                isTemporary: true,
                status: 'pending'
            };

            const docRef = await addDoc(collection(db, "temporary_music_sheets"), tempSongData);

            // Build a plain serializable snapshot — do NOT spread tempSongData because
            // it contains the serverTimestamp() sentinel which Firestore rejects when
            // nested inside the songs[] array written by handleSave.
            const newSong = {
                id: docRef.id,
                songName: tempSongData.songName,
                songArtist: tempSongData.songArtist,
                songKey: tempSongData.songKey,
                songCategory: tempSongData.songCategory,
                songArrangedBy: tempSongData.songArrangedBy,
                songBpm: tempSongData.songBpm,
                songLanguage: tempSongData.songLanguage,
                imageUrl: tempSongData.imageUrl,
                thumbnailUrl: tempSongData.thumbnailUrl,
                filePath: tempSongData.filePath,
                imageIds: tempSongData.imageIds,
                uploadedBy: tempSongData.uploadedBy,
                isTemporary: true,
                status: 'pending',
                createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            };

            setSelectedSongs(prev => [...prev, newSong]);
            setPendingUploadRes(null);
        } catch (error) {
            console.error("Error creating temp sheet", error);
            alert("데이터 저장 실패");
        } finally {
            setSavingTemp(false);
        }
    };

    const cancelTempSong = async () => {
        // Clean up the already-uploaded ImageKit file
        if (pendingUploadRes?.fileId) {
            try {
                await fetch("/api/imagekit/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileIds: [pendingUploadRes.fileId] }),
                });
            } catch (e) {
                console.error("ImageKit cleanup failed", e);
            }
        }
        setPendingUploadRes(null);
    };

    useEffect(() => {
        // Fetch songs once
        const fetchSongs = async () => {
            const q = query(collection(db, "music_sheets"), orderBy("songName"));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllSongs(data);
            setFilteredSongs(data);
            setLoading(false);
        };
        fetchSongs();
    }, []);

    // Handle Edit Mode or Init Song
    useEffect(() => {
        if (loading) return;

        // If Editing
        if (editSetId) {
            const fetchSet = async () => {
                const docRef = doc(db, "setlists", editSetId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setFormData({
                        name: data.name,
                        targetDate: data.setTargetDate || new Date().toISOString().split('T')[0]
                    });
                    setSelectedSongs(data.songs || []);
                    setIsEditing(true);
                }
            };
            fetchSet();
        }
        // If Creating with predefined song
        else if (initSongId && allSongs.length > 0) {
            // Check if already added to avoid duplicates on re-renders (though useEffect dependency handles this mostly)
            if (selectedSongs.length === 0) {
                const song = allSongs.find(s => s.id === initSongId);
                if (song) {
                    setSelectedSongs([song]);
                }
            }
        }
    }, [editSetId, initSongId, allSongs, loading]);

    useEffect(() => {
        let results = allSongs;

        if (search) {
            const lower = search.toLowerCase();
            results = results.filter(s =>
                s.songName.toLowerCase().includes(lower) ||
                s.songArtist?.toLowerCase().includes(lower) ||
                s.songKey?.toLowerCase().includes(lower)
            );
        }

        if (filterKey) {
            results = results.filter(s => s.songKey === filterKey);
        }

        if (filterLanguage) {
            results = results.filter(s => s.songLanguage === filterLanguage);
        }

        if (filterCategory) {
            results = results.filter(s => {
                if (Array.isArray(s.songCategory)) {
                    return s.songCategory.includes(filterCategory);
                }
                return s.songCategory === filterCategory;
            });
        }

        // Sort by relevance if searching
        if (search) {
            const lower = search.toLowerCase();
            results = [...results].sort((a, b) => {
                const aName = a.songName.toLowerCase();
                const bName = b.songName.toLowerCase();

                const aStarts = aName.startsWith(lower);
                const bStarts = bName.startsWith(lower);

                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                // Tie-breaker: creation date (assuming it exists or fallback)
                return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            });
        }

        setFilteredSongs(results);
    }, [search, filterKey, filterCategory, filterLanguage, allSongs]);

    const addSong = (song: any, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (selectedSongs.some(s => s.id === song.id)) return;
        setSelectedSongs([...selectedSongs, song]);
    };

    const removeSong = (index: number) => {
        const newSongs = [...selectedSongs];
        newSongs.splice(index, 1);
        setSelectedSongs(newSongs);
    };

    const moveSong = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === selectedSongs.length - 1) return;

        const newSongs = [...selectedSongs];
        const temp = newSongs[index];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        newSongs[index] = newSongs[targetIndex];
        newSongs[targetIndex] = temp;

        setSelectedSongs(newSongs);
    };

    const handleSave = async () => {
        if (!formData.name) {
            setFormData({ ...formData, name: formData.targetDate })
            // return;
        }
        setSaving(true);
        try {
            if (isEditing && editSetId) {
                await updateDoc(doc(db, "setlists", editSetId), {
                    name: formData.name,
                    setTargetDate: formData.targetDate,
                    songs: selectedSongs,
                });
            } else {
                await addDoc(collection(db, "setlists"), {
                    name: formData.name,
                    setTargetDate: formData.targetDate,
                    setOwner: user?.uid,
                    setCreatedDate: new Date(),
                    songs: selectedSongs, // storing full song objects for simplicity and snapshot preservation
                });
            }
            router.back(); // Go back to preserve history (either set viewer or song viewer)
        } catch (error) {
            console.error(error);
            alert("콘티 저장 실패");
            setSaving(false);
        }
    };

    return (
        <div className="animate-fade-in relative min-h-screen">
            <div className={styles.header}>
                <h1 className={styles.headerTitle}>{isEditing ? "콘티 수정" : "새 콘티 작성"}</h1>
                <div className="flex gap-2">
                    <button onClick={() => router.back()} className={styles.cancelBtn}>취소</button>
                    <button onClick={handleSave} disabled={saving} className={styles.createBtn}>
                        {saving ? "저장 중..." : (isEditing ? "수정 완료" : "콘티 저장")}
                    </button>
                </div>
            </div>

            <div className={styles.builderLayout}>
                {/* Left Col: Config & Song Selection */}
                <div className={styles.column}>
                    <div className={styles.inputForm}>
                        <div className={styles.formGroup}>
                            <input
                                className={`${styles.search} ${styles.mb0}`}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={`이름(${formData.targetDate})`}
                                autoFocus
                            />
                        </div>
                        <div className={styles.formGroup2}>
                            <div className="relative">
                                <div className={styles.formCalendarGroup}>
                                    <input
                                        type="text"
                                        readOnly
                                        className={styles.dateInput}
                                        value={formData.targetDate.replaceAll('-', '/')}
                                        onClick={() => setShowCalendar(!showCalendar)}
                                        placeholder="YYYY/MM/DD"
                                    />
                                    <button
                                        onClick={() => setShowCalendar(!showCalendar)}
                                        className={styles.calendarButton}
                                    >
                                        <FaCalendarAlt />
                                    </button>
                                </div>
                                {showCalendar && (
                                    <div className={styles.calendarContainer}>
                                        <div
                                            className="fixed inset-0 z-[-1]"
                                            onClick={() => setShowCalendar(false)}
                                        ></div>
                                        <Calendar
                                            onChange={(value: any) => {
                                                const date = value as Date;
                                                const year = date.getFullYear();
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const day = String(date.getDate()).padStart(2, '0');
                                                setFormData({ ...formData, targetDate: `${year}-${month}-${day}` });
                                                setShowCalendar(false);
                                            }}
                                            value={new Date(formData.targetDate)}
                                            formatDay={(locale, date) => date.getDate().toString()}
                                            className="!bg-transparent !border-0 text-white"
                                            tileClassName="!text-white hover:!bg-[var(--primary)] hover:!text-white rounded-lg"
                                            prevLabel="<"
                                            nextLabel=">"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className={styles.divider}></div>
                    <div className={styles.songSearch}>
                        <div className={styles.searchInputContainer}>
                            <input
                                className={styles.songSearchInput}
                                placeholder="라이브러리 검색..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className={styles.clearBtn}
                                >
                                    <FaTimes />
                                </button>
                            )}
                        </div>

                        <div className={styles.filterPopupContainer}>
                            <button
                                className={`${styles.filterBtn} ${showFilters || filterKey || filterLanguage || filterCategory ? styles.filterBtnActive : ''}`}
                                onClick={() => setShowFilters(!showFilters)}
                                title="필터 옵션"
                            >
                                <FaFilter size={14} />
                            </button>

                            {showFilters && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)}></div>
                                    <div className={styles.filterPopup}>
                                        <div>
                                            <div className={styles.filterPopupLabel}>Key</div>
                                            <select
                                                className={`${styles.filterSelect} ${styles.fullWidth}`}
                                                value={filterKey}
                                                onChange={e => setFilterKey(e.target.value)}
                                            >
                                                <option value="">모든 키</option>
                                                {["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map(k => (
                                                    <option key={k} value={k}>{k}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <div className={styles.filterPopupLabel}>언어</div>
                                            <select
                                                className={`${styles.filterSelect} ${styles.fullWidth}`}
                                                value={filterLanguage}
                                                onChange={e => setFilterLanguage(e.target.value)}
                                            >
                                                <option value="">모든 언어</option>
                                                <option value="한국어">한국어</option>
                                                <option value="영어">영어</option>
                                                <option value="아랍어">아랍어</option>
                                                <option value="터키어">터키어</option>
                                            </select>
                                        </div>

                                        <div>
                                            <div className={styles.filterPopupLabel}>카테고리</div>
                                            <select
                                                className={`${styles.filterSelect} ${styles.fullWidth}`}
                                                value={filterCategory}
                                                onChange={e => setFilterCategory(e.target.value)}
                                            >
                                                <option value="">모든 카테고리</option>
                                                <option value="상향">상향</option>
                                                <option value="외향">외향</option>
                                                <option value="내향">내향</option>
                                                <option value="JOY">JOY</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Left Col: Find and Select */}
                    <div className={styles.panelLeft}>


                        {filteredSongs.length === 0 ? (
                            <div className={styles.empty}>
                                결과 없음
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {filteredSongs.map(song => {
                                    const isAdded = selectedSongs.some(s => s.id === song.id);
                                    return (
                                        <div
                                            key={song.id}
                                            className={`${styles.songItem}`}
                                            onClick={() => setViewingSong(song)}
                                        >
                                            <div className={isAdded ? 'opacity-50' : ''}>
                                                <div className={styles.songItemName}>{song.songName}</div>
                                                <div className={styles.songItemArtist}>{song.songKey} • {song.songArtist}</div>
                                            </div>
                                            {isAdded ? (
                                                <div className="p-2">
                                                    <FaCheck className="text-green-500" />
                                                </div>
                                            ) : (
                                                <button
                                                    className={styles.addBtn}
                                                    onClick={(e) => addSong(song, e)}
                                                >
                                                    <FaPlus className={styles.songItemAdd} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Col: Selected & Ordering */}
                <div className={styles.column}>
                    <div className={styles.panelRight}>
                        <h3 className={styles.panelTitle}>
                            <span className={styles.songCountText}>{selectedSongs.length}곡 </span>
                        </h3>

                        {selectedSongs.length === 0 ? (
                            <div className={styles.empty}>
                                라이브러리에서 곡을 선택하세요
                            </div>
                        ) : (
                            <div>
                                {selectedSongs.map((song, idx) => (
                                    <div key={`${song.id}-${idx}`} className={styles.selectedSong}>
                                        <div>
                                            <div className={styles.selectedSongInfo}>
                                                <div className={styles.selectedSongNumber}>{idx + 1}</div>
                                                <div className={styles.selectedSongKey}>{song.songKey}</div>
                                            </div>
                                            <div>
                                                <div className="font-semibold">{song.songName}</div>
                                            </div>
                                        </div>

                                        <div className={styles.orderControls}>
                                            <button className={styles.controlBtn} onClick={() => moveSong(idx, 'up')} disabled={idx === 0}>
                                                <FaArrowUp />
                                            </button>
                                            <button className={styles.controlBtn} onClick={() => moveSong(idx, 'down')} disabled={idx === selectedSongs.length - 1}>
                                                <FaArrowDown />
                                            </button>
                                            <button className={styles.removeBtn} onClick={() => removeSong(idx)}>
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Upload Button */}
                        <div className="mt-4 pt-4 border-t border-white/10">
                            {publicKey && urlEndpoint ? (
                                <IKContext
                                    publicKey={publicKey}
                                    urlEndpoint={urlEndpoint}
                                    authenticator={authenticator}
                                >
                                    <IKUpload
                                        fileName="temp-sheet"
                                        onError={handleUploadError}
                                        onSuccess={handleUploadSuccess}
                                        onUploadStart={() => setUploading(true)}
                                        validateFile={(file: any) => file.size < 10000000}
                                        className={styles.uploadFileInput}
                                        id="temp-upload"
                                    />
                                    <label
                                        htmlFor="temp-upload"
                                        className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-dashed border-white/20 hover:bg-white/5 cursor-pointer transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <FaImage className="text-gray-400" />
                                        <span className="text-sm text-gray-300">
                                            {uploading ? "업로드 중..." : "이미지 직접 업로드"}
                                        </span>
                                    </label>
                                </IKContext>
                            ) : (
                                <div className="text-red-400 text-xs text-center">ImageKit 설정 필요</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Song Preview Modal */}
            <AnimatePresence>
                {viewingSong && (
                    <SongViewer
                        modalSong={viewingSong}
                        onClose={() => setViewingSong(null)}
                        // Read-only mode for preview
                        handleCreateSet={undefined}
                        isManager={false}
                    />
                )}
            </AnimatePresence>

            {/* Temp-song naming modal */}
            {pendingUploadRes && (
                <div className={styles.tempNameOverlay} onClick={cancelTempSong}>
                    <div className={styles.tempNameCard} onClick={e => e.stopPropagation()}>
                        <p className={styles.tempNameTitle}>악보 이름 입력</p>
                        <p className={styles.tempNameSubtitle}>매니저 승인 후 정식 등록됩니다</p>
                        <img
                            src={pendingUploadRes.thumbnailUrl || pendingUploadRes.url}
                            alt="uploaded sheet preview"
                            className={styles.tempNameThumb}
                        />
                        <input
                            autoFocus
                            className={styles.tempNameInput}
                            placeholder="예: 은혜 아니면 (임시)"
                            value={tempSongName}
                            onChange={e => setTempSongName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') confirmTempSong(); }}
                        />
                        <div className={styles.tempNameActions}>
                            <button className={styles.tempNameCancel} onClick={cancelTempSong}>취소</button>
                            <button
                                className={styles.tempNameConfirm}
                                onClick={confirmTempSong}
                                disabled={savingTemp}
                            >
                                {savingTemp ? "저장 중..." : "콘티에 추가"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NewSetlistPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <NewSetlistContent />
        </Suspense>
    );
}
