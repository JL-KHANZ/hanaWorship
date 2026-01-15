"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import styles from "../setlists.module.css";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { FaPlus, FaArrowUp, FaArrowDown, FaTrash, FaSearch, FaCalendarAlt, FaCheck } from "react-icons/fa";

export default function NewSetlistPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [allSongs, setAllSongs] = useState<any[]>([]);
    const [filteredSongs, setFilteredSongs] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [filterKey, setFilterKey] = useState("");
    const [filterCategory, setFilterCategory] = useState("");
    const [filterLanguage, setFilterLanguage] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        targetDate: new Date().toISOString().split('T')[0]
    });

    const [selectedSongs, setSelectedSongs] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);

    useEffect(() => {
        // Fetch songs once
        const fetchSongs = async () => {
            const q = query(collection(db, "music_sheets"), orderBy("songName"));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllSongs(data);
            setFilteredSongs(data);
        };
        fetchSongs();
    }, []);

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

        setFilteredSongs(results);
    }, [search, filterKey, filterCategory, filterLanguage, allSongs]);

    const addSong = (song: any) => {
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
            alert("Please name your setlist");
            return;
        }
        setSaving(true);
        try {
            await addDoc(collection(db, "setlists"), {
                name: formData.name,
                setTargetDate: formData.targetDate,
                setOwner: user?.uid,
                setCreatedDate: serverTimestamp(),
                songs: selectedSongs, // storing full song objects for simplicity and snapshot preservation
            });
            router.push("/dashboard/setlists");
        } catch (error) {
            console.error(error);
            alert("Failed to save setlist");
            setSaving(false);
        }
    };

    return (
        <div className="animate-fade-in relative min-h-screen">
            <div className={styles.header}>
                <h1 className={styles.headerTitle}>새 콘티 작성</h1>
                <div className="flex gap-2">
                    <button onClick={() => router.back()} className={styles.cancelBtn}>취소</button>
                    <button onClick={handleSave} disabled={saving} className={styles.createBtn}>
                        {saving ? "저장 중..." : "콘티 저장"}
                    </button>
                </div>
            </div>

            <div className={styles.builderLayout}>
                {/* Left Col: Config & Song Selection */}
                <div className={styles.column}>
                    <div className={styles.inputForm}>
                        <div className={styles.formGroup}>
                            <label className="text-sm opacity-70 mb-1">콘티 이름</label>
                            <input
                                className={styles.search}
                                style={{ marginBottom: 0 }}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="예: 주일 오전 예배"
                                autoFocus
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className="text-sm opacity-70 mb-1">예배 날짜</label>
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
                    <div className={styles.songSearch}>
                        <div className="relative">
                            <input
                                className={styles.search}
                                style={{ marginBottom: 5 }}
                                placeholder="라이브러리 검색..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <select
                                className={styles.filterSelect}
                                value={filterKey}
                                onChange={e => setFilterKey(e.target.value)}
                            >
                                <option value="">모든 키</option>
                                {["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].map(k => (
                                    <option key={k} value={k}>{k}</option>
                                ))}
                            </select>

                            <select
                                className={styles.filterSelect}
                                value={filterLanguage}
                                onChange={e => setFilterLanguage(e.target.value)}
                            >
                                <option value="">모든 언어</option>
                                <option value="한국어">한국어</option>
                                <option value="영어">영어</option>
                                <option value="아랍어">아랍어</option>
                                <option value="터키어">터키어</option>
                            </select>

                            {/* <select
                                className={styles.filterSelect}
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                            >
                                <option value="">모든 카테고리</option>
                                <option value="상향">상향</option>
                                <option value="하향">하향</option>
                                <option value="기타">기타</option>
                            </select> */}
                        </div>
                    </div>
                    <div className={styles.panelLeft}>

                        <div className="flex flex-col gap-1">
                            {filteredSongs.map(song => {
                                const isAdded = selectedSongs.some(s => s.id === song.id);
                                return (
                                    <div
                                        key={song.id}
                                        className={`${styles.songItem} ${isAdded ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
                                        onClick={() => !isAdded && addSong(song)}
                                    >
                                        <div>
                                            <div className={styles.songItemName}>{song.songName}</div>
                                            <div className={styles.songItemArtist}>{song.songKey} • {song.songArtist}</div>
                                        </div>
                                        {isAdded ? (
                                            <FaCheck className="text-green-500" />
                                        ) : (
                                            <FaPlus className={styles.songItemAdd} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Col: Selected & Ordering */}
                <div className={styles.column}>
                    <div className={styles.panelRight}>
                        <h3 className={styles.panelTitle}>
                            <span className="opacity-50 text-sm">{selectedSongs.length}곡 </span>
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
                    </div>
                </div>
            </div>
        </div>
    );
}
