"use client";

import React from "react";
import { FaYoutube } from "react-icons/fa";
import styles from "../dashboard.module.css";

interface SongLinkerProps {
    songName: string;
    songArtist?: string;
    songArrangedBy?: string;
}

export default function SongLinker({ songName, songArtist, songArrangedBy }: SongLinkerProps) {
    if (!songName) return null;

    const terms: string[] = [songName.trim()];

    // if (songArtist && songArtist.trim() !== "" && songArtist !== "Unknown" && songArtist !== "-") {
    //     terms.push(songArtist.trim());
    // }

    if (
        songArrangedBy &&
        songArrangedBy.trim() !== "" &&
        songArrangedBy !== "Unknown" &&
        songArrangedBy !== "-"
    ) {
        terms.push(songArrangedBy.trim());
    }

    const searchQuery = terms.join(" ");
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;

    return (
        <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`유튜브에서 검색: "${searchQuery}"`}
            className={styles.youtubeIcon}
            aria-label="유튜브 검색"
        >
            <FaYoutube className={styles.youtubeIconSvg} />
        </a>
    );
}
