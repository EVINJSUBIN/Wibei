/**
 * Wibei Zero-Dependency Audio Tag & Artwork Parser (ID3v2.3 / ID3v2.4 / ID3v1)
 * Extracts Title, Artist, Album, Year, Genre, and embedded APIC album artwork as Object URLs.
 */
(function(window) {
    'use strict';

    const GENRE_LIST = [
        'Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop',
        'Jazz','Metal','New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock',
        'Techno','Industrial','Alternative','Ska','Death Metal','Pranks','Soundtrack',
        'Euro-Techno','Ambient','Trip-Hop','Vocal','Jazz+Funk','Fusion','Trance',
        'Classical','Instrumental','Acid','House','Game','Sound Clip','Gospel','Noise',
        'AlternRock','Bass','Soul','Punk','Space','Meditative','Instrumental Pop',
        'Instrumental Rock','Ethnic','Gothic','Darkwave','Techno-Industrial','Electronic',
        'Pop-Folk','Eurodance','Dream','Southern Rock','Comedy','Cult','Gangsta',
        'Top 40','Christian Rap','Pop/Funk','Jungle','Native American','Cabaret',
        'New Wave','Psychadelic','Rave','Showtunes','Trailer','Lo-Fi','Tribal',
        'Acid Punk','Acid Jazz','Polka','Retro','Musical','Rock & Roll','Hard Rock',
        'Folk','Folk-Rock','National Folk','Swing','Fast Fusion','Bebob','Latin',
        'Revival','Celtic','Bluegrass','Avantgarde','Gothic Rock','Progressive Rock',
        'Psychedelic Rock','Symphonic Rock','Slow Rock','Big Band','Chorus',
        'Easy Listening','Acoustic','Humour','Speech','Chanson','Opera','Chamber Music',
        'Sonata','Symphony','Booty Bass','Primus','Porn Groove','Satire','Slow Jam',
        'Club','Tango','Samba','Folklore','Ballad','Power Ballad','Rhythmic Soul',
        'Freestyle','Duet','Punk Rock','Drum Solo','A capella','Euro-House','Dance Hall',
        'Goa','Drum & Bass','Club-House','Hardcore','Terror','Indie','BritPop',
        'Negerpunk','Polsk Punk','Beat','Christian Gangsta Rap','Heavy Metal',
        'Black Metal','Crossover','Contemporary Christian','Christian Rock',
        'Merengue','Salsa','Thrash Metal','Anime','Jpop','Synthpop'
    ];

    function decodeText(bytes, encoding) {
        if (!bytes || bytes.length === 0) return '';
        try {
            if (encoding === 1 || encoding === 2) {
                // UTF-16 with or without BOM
                const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                let isLittle = true;
                let offset = 0;
                if (bytes.length >= 2) {
                    if (bytes[0] === 0xFE && bytes[1] === 0xFF) { isLittle = false; offset = 2; }
                    else if (bytes[0] === 0xFF && bytes[1] === 0xFE) { isLittle = true; offset = 2; }
                }
                const chars = [];
                for (let i = offset; i < bytes.byteLength - 1; i += 2) {
                    const code = view.getUint16(i, isLittle);
                    if (code === 0) break;
                    chars.push(String.fromCharCode(code));
                }
                return chars.join('');
            } else if (encoding === 3) {
                // UTF-8
                const decoder = new TextDecoder('utf-8');
                return decoder.decode(bytes).replace(/\0.*$/, '');
            } else {
                // ISO-8859-1 (Latin1)
                const decoder = new TextDecoder('iso-8859-1');
                return decoder.decode(bytes).replace(/\0.*$/, '');
            }
        } catch (_) {
            return '';
        }
    }

    function parseID3v2(buffer) {
        const view = new DataView(buffer);
        if (buffer.byteLength < 10) return null;

        // Header check: "ID3"
        if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
            return null;
        }

        const version = view.getUint8(3); // 3 for 2.3, 4 for 2.4
        const flags = view.getUint8(5);
        // Synchsafe integer for size
        const tagSize = ((view.getUint8(6) & 0x7f) << 21) |
                        ((view.getUint8(7) & 0x7f) << 14) |
                        ((view.getUint8(8) & 0x7f) << 7)  |
                        (view.getUint8(9) & 0x7f);

        let offset = 10;
        // Check for extended header
        if (flags & 0x40) {
            const extSize = ((view.getUint8(10) & 0x7f) << 21) |
                            ((view.getUint8(11) & 0x7f) << 14) |
                            ((view.getUint8(12) & 0x7f) << 7)  |
                            (view.getUint8(13) & 0x7f);
            offset += extSize;
        }

        const metadata = {
            title: null,
            artist: null,
            album: null,
            year: null,
            genre: null,
            pictureUrl: null
        };

        const maxOffset = Math.min(buffer.byteLength, 10 + tagSize);

        while (offset + 10 < maxOffset) {
            // Read 4-character frame ID
            const idBytes = [view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3)];
            if (idBytes[0] === 0) break; // Padding reached
            const frameId = String.fromCharCode(...idBytes);

            let frameSize = 0;
            if (version === 4) {
                // ID3v2.4 uses synchsafe frame sizes
                frameSize = ((view.getUint8(offset+4) & 0x7f) << 21) |
                            ((view.getUint8(offset+5) & 0x7f) << 14) |
                            ((view.getUint8(offset+6) & 0x7f) << 7)  |
                            (view.getUint8(offset+7) & 0x7f);
            } else {
                // ID3v2.3 standard 32-bit int
                frameSize = view.getUint32(offset + 4);
            }

            if (frameSize <= 0 || offset + 10 + frameSize > maxOffset) break;

            const frameData = new Uint8Array(buffer, offset + 10, frameSize);

            // Handle Text Frames
            if (['TIT2', 'TPE1', 'TALB', 'TYER', 'TDRC', 'TCON'].includes(frameId)) {
                const encoding = frameData[0];
                const textBytes = frameData.subarray(1);
                const val = decodeText(textBytes, encoding).trim();

                if (frameId === 'TIT2') metadata.title = val;
                else if (frameId === 'TPE1') metadata.artist = val;
                else if (frameId === 'TALB') metadata.album = val;
                else if (frameId === 'TYER' || frameId === 'TDRC') metadata.year = val.slice(0, 4);
                else if (frameId === 'TCON') {
                    // Check if genre is numeric e.g. (17) or 17
                    const numMatch = val.match(/^\(?(\d+)\)?$/);
                    if (numMatch && GENRE_LIST[parseInt(numMatch[1], 10)]) {
                        metadata.genre = GENRE_LIST[parseInt(numMatch[1], 10)];
                    } else {
                        metadata.genre = val;
                    }
                }
            } 
            // Handle APIC (Attached Picture)
            else if (frameId === 'APIC') {
                try {
                    const encoding = frameData[0];
                    let p = 1;
                    // Read MIME type (null-terminated latin1)
                    let mime = '';
                    while (p < frameData.length && frameData[p] !== 0) {
                        mime += String.fromCharCode(frameData[p]);
                        p++;
                    }
                    p++; // skip null terminator
                    if (!mime) mime = 'image/jpeg';

                    const pictureType = frameData[p]; // 3 = front cover
                    p++;

                    // Description text (null-terminated depending on encoding)
                    if (encoding === 1 || encoding === 2) {
                        while (p < frameData.length - 1 && !(frameData[p] === 0 && frameData[p+1] === 0)) p += 2;
                        p += 2;
                    } else {
                        while (p < frameData.length && frameData[p] !== 0) p++;
                        p++;
                    }

                    // Remaining bytes are the image data
                    if (p < frameData.length) {
                        const imgBytes = frameData.subarray(p);
                        const blob = new Blob([imgBytes], { type: mime });
                        metadata.pictureUrl = URL.createObjectURL(blob);
                    }
                } catch (_) {}
            }

            offset += 10 + frameSize;
        }

        return metadata;
    }

    function parseID3v1(buffer) {
        if (buffer.byteLength < 128) return null;
        const view = new DataView(buffer);
        const start = buffer.byteLength - 128;
        // Check "TAG"
        if (view.getUint8(start) !== 0x54 || view.getUint8(start+1) !== 0x41 || view.getUint8(start+2) !== 0x47) {
            return null;
        }

        const decoder = new TextDecoder('iso-8859-1');
        const readStr = (o, l) => decoder.decode(new Uint8Array(buffer, start + o, l)).replace(/\0.*$/, '').trim();

        const title = readStr(3, 30);
        const artist = readStr(33, 30);
        const album = readStr(63, 30);
        const year = readStr(93, 4);
        const genreCode = view.getUint8(start + 127);
        const genre = GENRE_LIST[genreCode] || null;

        return { title, artist, album, year, genre, pictureUrl: null };
    }

    async function readAudioMetadata(file) {
        if (!file) return null;

        try {
            // Read first 256KB for ID3v2 header and tags
            const headChunk = file.slice(0, Math.min(file.size, 256 * 1024));
            const headBuffer = await headChunk.arrayBuffer();

            const v2Meta = parseID3v2(headBuffer);
            if (v2Meta && (v2Meta.title || v2Meta.artist || v2Meta.pictureUrl)) {
                return v2Meta;
            }

            // Fallback to ID3v1 at the end of the file
            if (file.size >= 128) {
                const tailChunk = file.slice(file.size - 128, file.size);
                const tailBuffer = await tailChunk.arrayBuffer();
                const v1Meta = parseID3v1(tailBuffer);
                if (v1Meta && (v1Meta.title || v1Meta.artist)) {
                    return v1Meta;
                }
            }
        } catch (_) {}

        return null;
    }

    window.readAudioMetadata = readAudioMetadata;
})(window);
