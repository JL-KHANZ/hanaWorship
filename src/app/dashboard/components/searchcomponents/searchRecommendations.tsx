"use client";

import React, { useMemo } from "react";
import "./searchrecommendation.css";
import { FaHistory, FaTimes, FaMusic } from "react-icons/fa";

interface SongItem {
    id: string;
    songName: string;
    songArtist?: string;
    songArrangedBy?: string;
    songKey?: string;
}

interface SearchRecommendationsProps {
    searchTerm: string;
    songs: SongItem[];
    recentSearches: string[];
    onSelectSearchTerm: (term: string) => void;
    onClearRecentSearch: (term: string, e: React.MouseEvent) => void;
}

interface ScoredRecommendation {
    song: SongItem;
    score: number;
    matchedBy: "songName" | "songArrangedBy" | "songArtist";
}

export default function SearchRecommendations({
    searchTerm,
    songs,
    recentSearches,
    onSelectSearchTerm,
    onClearRecentSearch,
}: SearchRecommendationsProps) {
    const trimmedQuery = searchTerm.trim().toLowerCase();

    // Calculate ranked recommendations based on similarity order: songName > songArrangedBy > songArtist
    const recommendations = useMemo(() => {
        if (!trimmedQuery) return [];

        const matches: ScoredRecommendation[] = [];

        songs.forEach((song) => {
            const name = (song.songName || "").toLowerCase();
            const arranged = (song.songArrangedBy || "").toLowerCase();
            const artist = (song.songArtist || "").toLowerCase();

            let score = 999;
            let matchedBy: "songName" | "songArrangedBy" | "songArtist" = "songName";

            // Priority 1: songName (startsWith: 10, includes: 20)
            if (name.startsWith(trimmedQuery)) {
                score = 10;
                matchedBy = "songName";
            } else if (name.includes(trimmedQuery)) {
                score = 20;
                matchedBy = "songName";
            }
            // Priority 2: songArrangedBy (startsWith: 30, includes: 40)
            else if (
                arranged &&
                arranged !== "-" &&
                arranged !== "unknown"
            ) {
                if (arranged.startsWith(trimmedQuery)) {
                    score = 30;
                    matchedBy = "songArrangedBy";
                } else if (arranged.includes(trimmedQuery)) {
                    score = 40;
                    matchedBy = "songArrangedBy";
                }
            }
            // Priority 3: songArtist (startsWith: 50, includes: 60)
            if (
                score === 999 &&
                artist &&
                artist !== "-" &&
                artist !== "unknown"
            ) {
                if (artist.startsWith(trimmedQuery)) {
                    score = 50;
                    matchedBy = "songArtist";
                } else if (artist.includes(trimmedQuery)) {
                    score = 60;
                    matchedBy = "songArtist";
                }
            }

            if (score < 999) {
                matches.push({ song, score, matchedBy });
            }
        });

        // Sort by score ascending, tie-break by song name alphabetically
        matches.sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;
            return a.song.songName.localeCompare(b.song.songName);
        });

        return matches.slice(0, 8); // Top 8 suggestions
    }, [songs, trimmedQuery]);

    // Render empty query view: Recent Searches
    if (!trimmedQuery) {
        if (recentSearches.length === 0) return null;

        return (
            <div className="dropdownContainer">
                <div className="sectionHeader">
                    <FaHistory /> 최근 검색어
                </div>
                <div className="historyList">
                    {recentSearches.map((term, index) => (
                        <div
                            key={`${term}-${index}`}
                            className="historyChip"
                            onClick={() => onSelectSearchTerm(term)}
                        >
                            <span>{term}</span>
                            <button
                                type="button"
                                className="historyChipDelete"
                                onClick={(e) => onClearRecentSearch(term, e)}
                                title="검색어 삭제"
                            >
                                <FaTimes />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Render active query view: Ranked Song Recommendations
    return (
        <div className="dropdownContainer">
            <div className="sectionHeader">
                <FaMusic /> 추천 검색어
            </div>
            {recommendations.length === 0 ? (
                <div className="emptyRecommendations">추천 결과가 없습니다.</div>
            ) : (
                <div className="recommendationList">
                    {recommendations.map(({ song, matchedBy }) => (
                        <div
                            key={song.id}
                            className="recommendationItem"
                            onClick={() => onSelectSearchTerm(song.songName)}
                        >
                            <div className="itemTitleRow">
                                <span className="itemSongName">{song.songName}</span>
                                {matchedBy === "songArrangedBy" && (
                                    <span className="matchBadge matchArranger">
                                        편곡: {song.songArrangedBy}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
