import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import useAuth from '../hooks/useAuth';
import LoginPage from './LoginPage';
import { touchBoard } from '../lib/boards';

function SaveButton({ item }) {
    const session = useAuth();
    const [boards, setBoards] = useState([]);
    const [showPicker, setShowPicker] = useState(false);
    const [showSavedMenu, setShowSavedMenu] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const [saved, setSaved] = useState(false);
    const [savedItemId, setSavedItemId] = useState(null);
    const [currentBoardId, setCurrentBoardId] = useState(null);
    const pickerRef = useRef(null);

    useEffect(() => {
        if (!session) return;
        supabase.from('boards').select('*').order('created_at', { ascending: true }).then(({ data }) => setBoards(data || []));
    }, [session]);

    useEffect(() => {
        if (session && showLogin) {
            setShowLogin(false);
            setShowPicker(true);
        }
    }, [session, showLogin]);

    useEffect(() => {
        if (!showPicker && !showSavedMenu) return;
        function handleClick(e) {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                setShowPicker(false);
                setShowSavedMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showPicker, showSavedMenu]);

    useEffect(() => {
        if (!session) return;
        async function checkSaved() {
            const { data: { user } } = await supabase.auth.getUser();
            const { data } = await supabase
                .from('saved_items')
                .select('id, board_id')
                .eq('user_id', user.id)
                .eq('item_data->>url', item.url)
                .limit(1);
            if (data && data.length > 0) {
                setSaved(true);
                setSavedItemId(data[0].id);
                setCurrentBoardId(data[0].board_id);
            }
        }
        checkSaved();
    }, [session, item.url]);

    useEffect(() => {
        if (!session) setSaved(false);
    }, [session]);

    function handleSaveClick() {
        if (saved) {
            setShowSavedMenu(prev => !prev);
            return;
        }
        if (!session) {
            setShowLogin(true);
        } else {
            setShowPicker(prev => !prev);
        }
    }

    async function handleSave(boardId) {
        await touchBoard(boardId);
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase.from('saved_items').insert({
            board_id: boardId,
            user_id: user.id,
            item_data: item,
        }).select();
        setShowPicker(false);
        setSaved(true);
        if (data) {
            setSavedItemId(data[0].id);
            setCurrentBoardId(boardId);
        }
    }

    async function handleCreateBoard() {
        if (!newBoardName.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase
            .from('boards')
            .insert({ user_id: user.id, name: newBoardName.trim() })
            .select();
        if (data) {
            const newBoard = data[0];
            setBoards(prev => [...prev, newBoard]);
            await handleSave(newBoard.id);
        }
        setNewBoardName('');
    }

    async function handleUnsave() {
        if (!savedItemId) return;
        await supabase.from('saved_items').delete().eq('id', savedItemId);
        setSaved(false);
        setSavedItemId(null);
        setCurrentBoardId(null);
        setShowSavedMenu(false);
    }

    async function handleMove(boardId) {
        await touchBoard(boardId);
        if (!savedItemId) return;
        await supabase.from('saved_items').update({ board_id: boardId }).eq('id', savedItemId);
        setCurrentBoardId(boardId);
        setShowPicker(false);
    }

    async function handleCreateAndMove() {
        if (!newBoardName.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase
            .from('boards')
            .insert({ user_id: user.id, name: newBoardName.trim() })
            .select();
        if (data) {
            const newBoard = data[0];
            setBoards(prev => [...prev, newBoard]);
            await handleMove(newBoard.id);
        }
        setNewBoardName('');
    }

    return (
        <div className="save-button" ref={pickerRef}>
            <button
                className={`save-btn ${showPicker && !saved ? 'active' : ''} ${saved ? 'saved' : ''}`}
                onClick={handleSaveClick}
            >
                {saved ? 'Saved' : 'Save'}
            </button>

            {showLogin && (
                <div className="modal" onClick={() => setShowLogin(false)}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <LoginPage onClose={() => setShowLogin(false)} />
                    </div>
                </div>
            )}

            {showPicker && !saved && (
                <div className="board-picker">
                    {boards.map(board => (
                        <button key={board.id} onClick={() => handleSave(board.id)}>
                            {board.name}
                        </button>
                    ))}
                    <input
                        value={newBoardName}
                        onChange={e => setNewBoardName(e.target.value)}
                        placeholder="New board name"
                        onKeyDown={e => e.key === 'Enter' && handleCreateBoard()}
                    />
                    <button className="create-save-btn" onClick={handleCreateBoard}>Create & Save</button>
                </div>
            )}

            {showPicker && saved && (
                <div className="board-picker">
                    {boards.filter(b => b.id !== currentBoardId).map(board => (
                        <button key={board.id} onClick={() => handleMove(board.id)}>
                            {board.name}
                        </button>
                    ))}
                    <input
                        value={newBoardName}
                        onChange={e => setNewBoardName(e.target.value)}
                        placeholder="New board name"
                        onKeyDown={e => e.key === 'Enter' && handleCreateAndMove()}
                    />
                    <button className="create-save-btn" onClick={handleCreateAndMove}>Create & Move</button>
                </div>
            )}

            {showSavedMenu && saved && (
                <div className="board-menu-dropdown-3">
                    <button onClick={() => { setShowPicker(true); setShowSavedMenu(false); }}>Move item</button>
                    <button className="delete-option" onClick={handleUnsave}>Unsave item</button>
                </div>
            )}
        </div>
    );
}

export default SaveButton;