"use client";

import React, { useState, useRef, useEffect } from "react";
import "./searchbar.css";
import { FaTimes, FaSearch } from "react-icons/fa";
import SearchRecommendations from "./searchRecommendations";

interface SearchBarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    songs: any[];
    recentSearches: string[];
    onAddRecentSearch: (term: string) => void;
    onClearRecentSearch: (term: string, e: React.MouseEvent) => void;
    placeholder?: string;
}

export default function SearchBar({
    searchTerm,
    onSearchChange,
    songs,
    recentSearches,
    onAddRecentSearch,
    onClearRecentSearch,
    placeholder = "곡 제목, 편곡자, 또는 아티스트 검색...",
}: SearchBarProps) {
    const [isFocused, setIsFocused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsFocused(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleSelectSearchTerm = (term: string) => {
        onSearchChange(term);
        onAddRecentSearch(term);
        setIsFocused(false);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            onAddRecentSearch(searchTerm);
            setIsFocused(false);
            inputRef.current?.blur();
        }
    };

    return (
        <div className="searchBarContainer" ref={containerRef}>
            <div className="searchInputWrapper">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    className="searchInput"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onKeyDown={handleKeyDown}
                />
                {searchTerm && (
                    <button
                        type="button"
                        onClick={() => {
                            onSearchChange("");
                            inputRef.current?.focus();
                        }}
                        className="clearButton"
                        title="검색어 지우기"
                    >
                        <FaTimes />
                    </button>
                )}
            </div>

            {isFocused && (
                <SearchRecommendations
                    searchTerm={searchTerm}
                    songs={songs}
                    recentSearches={recentSearches}
                    onSelectSearchTerm={handleSelectSearchTerm}
                    onClearRecentSearch={onClearRecentSearch}
                />
            )}
        </div>
    );
}
