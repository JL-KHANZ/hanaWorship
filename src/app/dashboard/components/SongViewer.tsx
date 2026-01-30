"use client";
import { useState, useEffect } from "react";
import styles from "../dashboard.module.css";
import { AnimatePresence, motion } from "framer-motion";
import { FaTimes, FaPen, FaSave, FaTrash, FaPlus } from "react-icons/fa";

interface SongViewerProps {
    modalSong: any;
    onClose: () => void;
    startEditing?: () => void;
    isEditing?: boolean;
    editForm?: any;
    setEditForm?: (form: any) => void;
    handleSave?: () => void;
    handleDelete?: () => void;
    setIsEditing?: (isEditing: boolean) => void;
    isManager?: boolean;
    songList?: any[];
    onNavigate?: (song: any) => void;
    handleCreateSet?: (songId: string) => void;
}

export default function SongViewer({
    modalSong,
    onClose,
    startEditing,
    isEditing = false,
    editForm,
    setEditForm,
    handleSave,
    handleDelete,
    setIsEditing,
    isManager,
    songList,
    onNavigate,
    handleCreateSet
}: SongViewerProps) {
    const [showControls, setShowControls] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);

    // Determine available pages
    const pages = modalSong.pages && modalSong.pages.length > 0 ? modalSong.pages : [modalSong.imageUrl];
    const hasMultiplePages = pages.length > 1;

    // Reset page when song changes
    useEffect(() => {
        setCurrentPage(0);
    }, [modalSong.id]);

    // Reset edit mode on close
    const handleClose = () => {
        if (setIsEditing) setIsEditing(false);
        onClose();
    };

    const toggleControls = () => {
        if (!isEditing) {
            setShowControls(prev => !prev);
        }
    };

    const currentIndex = songList?.findIndex((s: any) => s.id === modalSong.id) ?? -1;
    const hasNextSong = currentIndex !== -1 && songList && currentIndex < songList.length - 1;
    const hasPrevSong = currentIndex !== -1 && currentIndex > 0;

    const nextPage = (e?: any) => {
        e?.stopPropagation();
        if (currentPage < pages.length - 1) {
            // Next Page
            setCurrentPage(prev => prev + 1);
        } else if (hasNextSong && onNavigate && songList) {
            // Next Song
            onNavigate(songList[currentIndex + 1]);
        }
    };

    const prevPage = (e?: any) => {
        e?.stopPropagation();
        if (currentPage > 0) {
            // Prev Page
            setCurrentPage(prev => prev - 1);
        } else if (hasPrevSong && onNavigate && songList) {
            // Prev Song
            onNavigate(songList[currentIndex - 1]);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.viewerOverlay}
            onClick={toggleControls}
            drag // Allow drag in both directions
            dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset, velocity }) => {
                const swipeThreshold = 50;
                // Horizontal Swipe (Page Change)
                if (Math.abs(offset.x) > Math.abs(offset.y) && Math.abs(offset.x) > swipeThreshold) {
                    if (offset.x < 0) nextPage(); // Swipe Left -> Next
                    else prevPage(); // Swipe Right -> Prev
                }
                // Vertical Swipe (Close)
                else if (offset.y > swipeThreshold || velocity.y > 100) {
                    handleClose();
                }
            }}
        >
            {/* Image Container */}
            <div className={styles.viewerImageContainer}>
                {pages[currentPage] ? (
                    <img
                        key={currentPage} // Force re-render for animation if needed, or simply switch src
                        src={pages[currentPage]}
                        alt={`${modalSong.songName} - Page ${currentPage + 1}`}
                        className={`${styles.viewerImage} ${isEditing ? 'opacity-10 grayscale blur-sm transition-all duration-300' : 'transition-all duration-300'}`}
                    />
                ) : (
                    <div className={styles.modalFallback}>
                        이미지가 없습니다
                    </div>
                )}
            </div>

            {/* Top Bar */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className={styles.viewerTopBar}
                        onClick={e => e.stopPropagation()}
                    >
                        {handleCreateSet ? (
                            <div className={styles.createSetBtnContainer}>

                                <div className={styles.songKey}>
                                    {modalSong.songKey}
                                </div>
                                <button
                                    onClick={() => handleCreateSet(modalSong.id)}
                                    className={styles.createSetBtn}
                                >
                                    <FaPlus size={12} /> 콘티 생성
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1"></div>
                        )}
                        <button onClick={handleClose} className={styles.viewerCloseBtn}>
                            <FaTimes />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Bar */}
            <AnimatePresence>
                {(showControls || isEditing) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className={styles.viewerBottomBar}
                        onClick={e => isEditing && e.stopPropagation()} // Stop propagation only if editing to prevent toggle
                    >
                        {isEditing && editForm && setEditForm && handleSave && handleDelete ? (
                            <div className="flex flex-col gap-2 p-6 bg-zinc-900 rounded-xl shadow-2xl border border-white/10 w-full max-w-md" onClick={e => e.stopPropagation()}>
                                <h3 className="text-white font-bold mb-2">악보 정보 수정</h3>
                                <input
                                    className={styles.editInput}
                                    value={editForm.songName}
                                    onChange={e => setEditForm({ ...editForm, songName: e.target.value })}
                                    placeholder="곡 제목"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <input
                                        className={styles.editInput}
                                        style={{ width: '80px' }}
                                        value={editForm.songKey}
                                        onChange={e => setEditForm({ ...editForm, songKey: e.target.value })}
                                        placeholder="Key"
                                    />
                                    <input
                                        className={styles.editInput}
                                        style={{ flex: 1 }}
                                        value={editForm.songArtist}
                                        onChange={e => setEditForm({ ...editForm, songArtist: e.target.value })}
                                        placeholder="아티스트"
                                    />
                                </div>
                                <div className="mt-2">
                                    <select
                                        className={styles.editInput}
                                        value={editForm.songLanguage}
                                        onChange={e => setEditForm({ ...editForm, songLanguage: e.target.value })}
                                    >
                                        <option value="한국어">한국어</option>
                                        <option value="영어">영어</option>
                                        <option value="아랍어">아랍어</option>
                                        <option value="터키어">터키어</option>
                                    </select>
                                    <select
                                        className={styles.editInput}
                                        value={editForm.songCategory}
                                        onChange={e => setEditForm({ ...editForm, songCategory: e.target.value })}
                                    >
                                        <option value="상향">상향</option>
                                        <option value="외향">외향</option>
                                        <option value="내향">내향</option>
                                        <option value="JOY">JOY</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 justify-between mt-4">
                                    <button
                                        onClick={handleDelete}
                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                        title="곡 삭제"
                                    >
                                        <FaTrash />
                                    </button>
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsEditing && setIsEditing(false)} className="px-4 py-2 text-sm bg-white/10 rounded hover:bg-white/20 text-white transition-colors">취소</button>
                                        <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 rounded hover:bg-blue-500 flex items-center gap-2 text-white font-medium transition-colors">
                                            <FaSave /> 저장하기
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center" onClick={e => e.stopPropagation()}>
                                <div className={styles.viewerTitle}>
                                    {modalSong.songName}

                                    {isManager && startEditing && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); startEditing(); }}
                                            className="opacity-50 hover:opacity-100 transition-opacity p-2 text-white hover:text-blue-400 text-sm"
                                            title="수정하기"
                                        >
                                            <FaPen />
                                        </button>
                                    )}
                                </div>
                                <div className={styles.viewerSubtitle}>
                                    {modalSong.songArtist}
                                    {/* Page Indicator */}
                                    <span>
                                        {currentPage + 1} / {pages.length}
                                    </span>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
