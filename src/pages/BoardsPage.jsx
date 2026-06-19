import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useAuth from '../hooks/useAuth';
import ProfileMenu from "../components/ProfileMenu";

function BoardMenu({ board, onDelete, onRename }) {
    const [open, setOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [newName, setNewName] = useState(board.name);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        function handleClick(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
                setRenaming(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    async function handleRename() {
        if (!newName.trim() || newName === board.name) { setRenaming(false); return; }
        await supabase.from('boards').update({ name: newName.trim() }).eq('id', board.id);
        onRename(board.id, newName.trim());
        setRenaming(false);
        setOpen(false);
    }

    return (
        <div className="board-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
            <button className="board-menu-btn" onClick={() => {
                setOpen(prev => {
                    if (prev) setRenaming(false);
                    return !prev;
                });
            }}>···</button>
            {open && (
                <div className="board-menu-dropdown">
                    {renaming ? (
                        <div className="board-rename-row">
                            <input
                                autoFocus
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleRename()}
                            />
                            <button onClick={handleRename}>Save</button>
                        </div>
                    ) : (
                        <>
                            <button onClick={() => setRenaming(true)}>Rename board</button>
                            <button className="delete-option" onClick={() => { onDelete(board.id); setOpen(false); }}>Delete board</button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function BoardsPage() {
    const session = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const menuRef = useRef(null);
    const [boards, setBoards] = useState(() => {
        const cached = sessionStorage.getItem('cachedBoards');
        return cached ? JSON.parse(cached) : [];
    });
    const [loading, setLoading] = useState(() => !sessionStorage.getItem('cachedBoards'));

    useEffect(() => {
        if (!menuOpen) return;
        function handleClick(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen]);

    useEffect(() => {
        if (!session) return;
        fetchBoards();
    }, [session]);

    async function fetchBoards() {
        const { data: boardsData } = await supabase
            .from('boards')
            .select('*')
            .order('last_added_at', { ascending: false });

        if (!boardsData) { setLoading(false); return; }

        const boardsWithCovers = await Promise.all(
            boardsData.map(async (board) => {
                const { data: items, count } = await supabase
                    .from('saved_items')
                    .select('item_data', { count: 'exact' })
                    .eq('board_id', board.id)
                    .order('created_at', { ascending: false })
                    .limit(3);
                return { ...board, coverItems: items || [], totalCount: count || 0 };
            })
        );

        setBoards(boardsWithCovers);
        sessionStorage.setItem('cachedBoards', JSON.stringify(boardsWithCovers));
        setLoading(false);
    }

    async function handleCreate() {
        if (!newBoardName.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase
            .from('boards')
            .insert({ user_id: user.id, name: newBoardName.trim() })
            .select();
        if (data) {
            const newBoard = { ...data[0], coverItems: [], totalCount: 0 };
            setBoards(prev => {
                const updated = [newBoard, ...prev];
                sessionStorage.setItem('cachedBoards', JSON.stringify(updated));
                return updated;
            });
            setNewBoardName('');
            setMenuOpen(false);
        }
    }

    async function handleDelete(boardId) {
        const { error } = await supabase.from('boards').delete().eq('id', boardId);
        if (error) { console.error(error); return; }
        setBoards(prev => {
            const updated = prev.filter(b => b.id !== boardId);
            sessionStorage.setItem('cachedBoards', JSON.stringify(updated));
            return updated;
        });
    }

    function handleRename(boardId, newName) {
        setBoards(prev => {
            const updated = prev.map(b => b.id === boardId ? { ...b, name: newName } : b);
            sessionStorage.setItem('cachedBoards', JSON.stringify(updated));
            return updated;
        });
    }

    if (session === undefined) return null;
    if (!session) return (
        <div className="boards-empty">
            <p>Please log in to view your boards.</p>
            <button onClick={() => navigate('/')}>Go Home</button>
        </div>
    );

    return (
        <>
            <div className="app-header-wrap">
                <div className="app-header">
                    <span className="logo-link" onClick={() => navigate('/', { replace: true })}>Rent the Look</span>
                    <div className="header-nav">
                        <button className="nav-tab" onClick={() => navigate('/')}>Home</button>
                        <button className="nav-tab" onClick={() => navigate('/boards')}>My Boards</button>
                        <ProfileMenu session={session} />
                    </div>
                </div>
            </div>
            <div className="boards-page">
                <div className="boards-header">
                    <h1>My Boards</h1>
                    <div className="board-menu" ref={menuRef}>
                        <button className="board-menu-btn" onClick={() => setMenuOpen(prev => !prev)}>···</button>
                        {menuOpen && (
                            <div className="board-menu-dropdown-2">
                                <input
                                    value={newBoardName}
                                    onChange={e => setNewBoardName(e.target.value)}
                                    placeholder="New board name"
                                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                />
                                <button onClick={handleCreate}>Create</button>
                            </div>
                        )}
                    </div>
                </div>
                {!loading && boards.length === 0 ? (
                    <p className="select-prompt">No boards yet. Create one to get started.</p>
                ) : (
                    <div className="board-grid">
                        {boards.map(board => (
                            <div key={board.id} className="board" onClick={() => {
                                navigate(`/boards/${board.id}`, { state: { name: board.name, items: null } });
                            }}>
                                <div className="board-cover">
                                    {board.coverItems[0]?.item_data?.image ? (
                                        <div className="board-cover-mosaic">
                                            <img className="cover-main" src={board.coverItems[0].item_data.image} alt="" />
                                            <div className="cover-side">
                                                {board.coverItems[1]?.item_data?.image
                                                    ? <img src={board.coverItems[1].item_data.image} alt="" />
                                                    : <div className="cover-placeholder" />
                                                }
                                                {board.coverItems[2]?.item_data?.image
                                                    ? <img src={board.coverItems[2].item_data.image} alt="" />
                                                    : <div className="cover-placeholder" />
                                                }
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="board-cover-empty">No items yet</div>
                                    )}
                                </div>
                                <div className="board-info">
                                    <div className="board-info-row">
                                        <span className="board-name">{board.name}</span>
                                        <BoardMenu
                                            board={board}
                                            onDelete={handleDelete}
                                            onRename={handleRename}
                                        />
                                    </div>
                                    <span className="board-count">{board.totalCount} {board.totalCount === 1 ? 'Item' : 'Items'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

export default BoardsPage;