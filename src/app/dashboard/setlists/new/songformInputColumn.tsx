import React, { useRef, useEffect, useLayoutEffect } from 'react';
import styles from './songformInputColumn.module.css';

interface Song {
  id: string;
  songName: string;
  songKey: string;
  songForm?: string;
}

interface SongFormColumnProps {
  selectedSongs: Song[];
  chosenSongIndex: number | null;
  onSongFormChange: (index: number, value: string) => void;
  onSelectSong?: (index: number) => void;
}

export const SongFormColumn: React.FC<SongFormColumnProps> = ({
  selectedSongs,
  chosenSongIndex,
  onSongFormChange,
  onSelectSong,
}) => {
  const activeCardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Key derived from song IDs to detect structural changes (adds, removes, reorders)
  const songListKey = selectedSongs.map((s) => s.id).join('-');

  // 1. Initial height calculation on mount or structural changes ONLY
  useLayoutEffect(() => {
    if (panelRef.current) {
      const textareas = panelRef.current.querySelectorAll<HTMLTextAreaElement>('textarea');
      textareas.forEach((textarea) => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      });
    }
  }, [songListKey]); // 👈 Re-run ONLY when songs list layout changes, NOT on text edit!

  // 2. Scroll to active card ONLY when chosenSongIndex changes
  useEffect(() => {
    if (chosenSongIndex !== null && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [chosenSongIndex]);

  const handleTextareaInput = (index: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    const panel = panelRef.current;

    // Preserve scroll position before height adjustment
    const currentScrollTop = panel ? panel.scrollTop : 0;

    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;

    // Restore scroll position immediately to prevent snapping
    if (panel) {
      panel.scrollTop = currentScrollTop;
    }

    onSongFormChange(index, target.value);
  };

  if (selectedSongs.length === 0) {
    return (
      <div className={styles.panelRight}>
        <p>선택된 곡이 없습니다</p>
      </div>
    );
  }

  return (
    <div ref={panelRef} className={styles.panelRight}>
      {selectedSongs.map((song, idx) => {
        const isChosen = idx === chosenSongIndex;

        return (
          <div
            key={`${song.id}-${idx}`}
            ref={isChosen ? activeCardRef : null}
            className={`${styles.songFormCard} ${isChosen ? styles.activeCard : styles.inactiveCard}`}
          >
            <div className={styles.songFormHeader}>
              <span className={styles.songIndex}>{idx + 1}. </span>
              <span className={styles.songTitle}>{song.songName}</span>
            </div>

            <textarea
              value={song.songForm || ''}
              onChange={(e) => handleTextareaInput(idx, e)}
              placeholder={isChosen ? "눌러서 송폼 작성" : "송폼"}
              className={`${styles.songFormTextarea} ${!isChosen ? styles.readOnlyTextarea : ''}`}
              readOnly={!isChosen}
            />
          </div>
        );
      })}
    </div>
  );
};