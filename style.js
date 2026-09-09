// Supabase 클라이언트 초기화
const SUPABASE_URL = 'https://idswpgvoipgbuehvkryy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W1bOpC1_zqv66Ur0wLUAdQ_pKIjOCBd';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;
let activeMeetingFilter = 'all';
let activeRegionFilter = 'all';
let activePostCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    checkUserSession();
    fetchMeetings();
    fetchPosts();
}

// ------------------- AUTH -------------------
async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await fetchProfile(currentUser.id);
        updateUserUI(true);
    } else {
        updateUserUI(false);
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = session.user;
            await fetchProfile(currentUser.id);
            updateUserUI(true);
        } else {
            currentUser = null;
            currentProfile = null;
            updateUserUI(false);
        }
    });
}

async function fetchProfile(userId) {
    const { data } = await supabaseClient.from('mrt_profiles').select('*').eq('id', userId).single();
    if (data) currentProfile = data;
}

function updateUserUI(isLoggedIn) {
    const statusContainer = document.getElementById('user-status');
    if (isLoggedIn) {
        const nickname = currentProfile ? currentProfile.nickname : (currentUser.email.split('@')[0]);
        statusContainer.innerHTML = `
            <span>🏃‍♂️ <strong>${nickname}</strong> 님</span>
            <button id="btn-logout" class="btn btn-outline"><i class="fa-solid fa-right-from-bracket"></i> 로그아웃</button>
        `;
        document.getElementById('btn-logout').addEventListener('click', () => supabaseClient.auth.signOut());
    } else {
        statusContainer.innerHTML = `
            <button id="btn-login-modal" class="btn btn-outline"><i class="fa-solid fa-right-to-bracket"></i> 로그인 / 회원가입</button>
        `;
        document.getElementById('btn-login-modal').addEventListener('click', () => openModal('modal-auth'));
    }
}

// ------------------- MEETINGS CRUD -------------------
async function fetchMeetings() {
    const listContainer = document.getElementById('meeting-list');
    let query = supabaseClient.from('mrt_meetings').select('*, mrt_profiles(nickname)').order('event_date', { ascending: true });

    if (activeMeetingFilter !== 'all') query = query.eq('type', activeMeetingFilter);
    if (activeRegionFilter !== 'all') query = query.eq('region', activeRegionFilter);

    const { data: meetings, error } = await query;
    if (error || !meetings || meetings.length === 0) {
        listContainer.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px;">등록된 러닝 모임이 없습니다.</div>';
        return;
    }

    const { data: applications } = await supabaseClient.from('mrt_meeting_applications').select('*');

    listContainer.innerHTML = meetings.map(m => {
        const typeLabel = m.type === 'quarterly' ? '🏆 분기별 정기모임' : '👟 매주 소규모모임';
        const tagClass = m.type === 'quarterly' ? 'tag-quarterly' : 'tag-weekly';
        const formattedDate = new Date(m.event_date).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const appliedCount = applications ? applications.filter(a => a.meeting_id === m.id).length : 0;
        const isOwner = currentUser && currentUser.id === m.created_by;
        const hasApplied = applications && currentUser && applications.some(a => a.meeting_id === m.id && a.user_id === currentUser.id);

        return `
            <div class="meeting-card">
                <div>
                    <span class="card-type-tag ${tagClass}">${typeLabel}</span>
                    <h3 class="card-title">${m.title}</h3>
                    <div class="card-info">
                        <div>📅 ${formattedDate}</div>
                        <div>📍 ${m.region}</div>
                        <div>👥 신청: ${appliedCount} / ${m.max_participants}명</div>
                    </div>
                    <p class="card-desc">${m.description}</p>
                </div>
                <div class="card-footer">
                    <span style="font-size: 0.85rem;">주최: ${m.mrt_profiles?.nickname || '알수없음'}</span>
                    ${isOwner ? `<button class="btn btn-danger" onclick="deleteMeeting(${m.id})">삭제</button>` : 
                        `<button class="btn ${hasApplied ? 'btn-outline' : 'btn-primary'}" onclick="toggleApplyMeeting(${m.id}, ${hasApplied})">${hasApplied ? '신청취소' : '참가신청 🏃'}</button>`}
                </div>
            </div>
        `;
    }).join('');
}

async function handleSaveMeeting(e) {
    e.preventDefault();
    if (!currentUser) { alert('로그인이 필요합니다.'); openModal('modal-auth'); return; }

    const { error } = await supabaseClient.from('mrt_meetings').insert([{
        title: document.getElementById('meeting-title').value,
        type: document.getElementById('meeting-type').value,
        region: document.getElementById('meeting-region').value,
        event_date: document.getElementById('meeting-date').value,
        max_participants: parseInt(document.getElementById('meeting-max').value),
        description: document.getElementById('meeting-desc').value,
        created_by: currentUser.id
    }]);

    if (!error) { alert('모임이 등록되었습니다!'); closeModal('modal-meeting'); fetchMeetings(); }
}

async function toggleApplyMeeting(meetingId, hasApplied) {
    if (!currentUser) { alert('로그인이 필요합니다.'); openModal('modal-auth'); return; }
    if (hasApplied) {
        await supabaseClient.from('mrt_meeting_applications').delete().eq('meeting_id', meetingId).eq('user_id', currentUser.id);
    } else {
        await supabaseClient.from('mrt_meeting_applications').insert([{ meeting_id: meetingId, user_id: currentUser.id }]);
    }
    fetchMeetings();
}

async function deleteMeeting(meetingId) {
    if (confirm('삭제하시겠습니까?')) {
        await supabaseClient.from('mrt_meetings').delete().eq('id', meetingId);
        fetchMeetings();
    }
}

// ------------------- POSTS CRUD -------------------
async function fetchPosts() {
    const listContainer = document.getElementById('board-post-list');
    let query = supabaseClient.from('mrt_posts').select('*, mrt_profiles(nickname)').order('created_at', { ascending: false });

    if (activePostCategory !== 'all') query = query.eq('category', activePostCategory);

    const { data: posts } = await query;
    if (!posts || posts.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">게시글이 없습니다.</td></tr>';
        return;
    }

    listContainer.innerHTML = posts.map(p => `
        <tr>
            <td>${p.category === 'review' ? '⭐후기' : '🗣️자유'}</td>
            <td onclick="openPostDetail(${p.id})" style="cursor:pointer; font-weight:600;">${p.title}</td>
            <td>${p.mrt_profiles?.nickname || '익명'}</td>
            <td>${new Date(p.created_at).toLocaleDateString()}</td>
            <td>${currentUser && currentUser.id === p.author_id ? `<button class="btn btn-danger" onclick="deletePost(${p.id})">삭제</button>` : ''}</td>
        </tr>
    `).join('');
}

async function handleSavePost(e) {
    e.preventDefault();
    if (!currentUser) { alert('로그인이 필요합니다.'); openModal('modal-auth'); return; }

    const { error } = await supabaseClient.from('mrt_posts').insert([{
        category: document.getElementById('post-category').value,
        title: document.getElementById('post-title').value,
        content: document.getElementById('post-content').value,
        author_id: currentUser.id
    }]);

    if (!error) { alert('게시글이 작성되었습니다.'); closeModal('modal-post'); fetchPosts(); }
}

async function openPostDetail(postId) {
    const { data: post } = await supabaseClient.from('mrt_posts').select('*, mrt_profiles(nickname)').eq('id', postId).single();
    if (!post) return;

    document.getElementById('post-detail-container').innerHTML = `
        <h2>${post.title}</h2>
        <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 15px;">작성자: ${post.mrt_profiles?.nickname || '익명'}</p>
        <p style="white-space: pre-line;">${post.content}</p>
    `;
    openModal('modal-post-detail');
}

async function deletePost(postId) {
    if (confirm('삭제하시겠습니까?')) {
        await supabaseClient.from('mrt_posts').delete().eq('id', postId);
        fetchPosts();
    }
}

// ------------------- EVENTS & MODAL -------------------
function setupEventListeners() {
    document.querySelectorAll('#meeting-type-filter .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#meeting-type-filter .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeMeetingFilter = e.target.dataset.type;
            fetchMeetings();
        });
    });

    document.getElementById('meeting-region-select').addEventListener('change', (e) => {
        activeRegionFilter = e.target.value;
        fetchMeetings();
    });

    document.getElementById('btn-open-meeting-modal').addEventListener('click', () => openModal('modal-meeting'));
    document.getElementById('btn-hero-create').addEventListener('click', () => openModal('modal-meeting'));
    document.getElementById('btn-open-post-modal').addEventListener('click', () => openModal('modal-post'));

    document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.target)));
    document.getElementById('form-meeting').addEventListener('submit', handleSaveMeeting);
    document.getElementById('form-post').addEventListener('submit', handleSavePost);

    document.getElementById('btn-signup').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const nickname = document.getElementById('auth-nickname').value;
        if (!nickname) { alert('닉네임을 입력해주세요.'); return; }

        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (!error && data.user) {
            await supabaseClient.from('mrt_profiles').insert([{ id: data.user.id, email, nickname }]);
            alert('회원가입이 완료되었습니다.');
            closeModal('modal-auth');
        } else { alert(error.message); }
    });

    document.getElementById('form-auth').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (!error) closeModal('modal-auth');
        else alert('로그인 실패: ' + error.message);
    });
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
