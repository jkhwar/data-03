// Supabase 클라이언트 연결
const SUPABASE_URL = 'https://idswpgvoipgbuehvkryy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W1bOpC1_zqv66Ur0wLUAdQ_pKIjOCBd';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let activeMeetingFilter = 'all';
let activeRegionFilter = 'all';
let activePostCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
    fetchMeetings();
    fetchPosts();
    setupEventListeners();
});

// ------------------- MEETINGS (모임 CRUD) -------------------
async function fetchMeetings() {
    const listContainer = document.getElementById('meeting-list');
    let query = supabaseClient.from('mrt_meetings').select('*').order('event_date', { ascending: true });

    if (activeMeetingFilter !== 'all') query = query.eq('type', activeMeetingFilter);
    if (activeRegionFilter !== 'all') query = query.eq('region', activeRegionFilter);

    const { data: meetings, error } = await query;
    if (error || !meetings || meetings.length === 0) {
        listContainer.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: #64748b;">등록된 러닝 모임이 없습니다. 첫 모임을 개설해보세요! 🏃‍♂️</div>';
        return;
    }

    const { data: applications } = await supabaseClient.from('mrt_meeting_applications').select('*');

    listContainer.innerHTML = meetings.map(m => {
        const typeLabel = m.type === 'quarterly' ? '🏆 분기별 정기모임' : '👟 매주 소규모모임';
        const tagClass = m.type === 'quarterly' ? 'tag-quarterly' : 'tag-weekly';
        const formattedDate = new Date(m.event_date).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const appliedCount = applications ? applications.filter(a => a.meeting_id === m.id).length : 0;

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
                    <span style="font-size: 0.85rem; color: #64748b;">주최: ${m.author_name}</span>
                    <div>
                        <button class="btn btn-primary" onclick="applyMeeting(${m.id})">참가신청 🏃</button>
                        <button class="btn btn-danger" onclick="deleteMeeting(${m.id})">삭제</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function handleSaveMeeting(e) {
    e.preventDefault();
    const author_name = document.getElementById('meeting-author').value;
    const title = document.getElementById('meeting-title').value;
    const type = document.getElementById('meeting-type').value;
    const region = document.getElementById('meeting-region').value;
    const event_date = document.getElementById('meeting-date').value;
    const max_participants = parseInt(document.getElementById('meeting-max').value);
    const description = document.getElementById('meeting-desc').value;

    const { error } = await supabaseClient.from('mrt_meetings').insert([{
        author_name, title, type, region, event_date, max_participants, description
    }]);

    if (error) {
        alert('모임 개설 실패: ' + error.message);
    } else {
        alert('러닝 모임이 성공적으로 생성되었습니다!');
        closeModal('modal-meeting');
        document.getElementById('form-meeting').reset();
        fetchMeetings();
    }
}

async function applyMeeting(meetingId) {
    const applicant_name = prompt('참가 신청자 닉네임을 입력하세요:', '익명러너');
    if (!applicant_name) return;

    const { error } = await supabaseClient.from('mrt_meeting_applications').insert([{
        meeting_id: meetingId, applicant_name
    }]);

    if (error) alert('신청 실패: ' + error.message);
    else {
        alert('참가 신청이 완료되었습니다! 🏃');
        fetchMeetings();
    }
}

async function deleteMeeting(meetingId) {
    if (confirm('정말로 이 모임을 삭제하시겠습니까?')) {
        const { error } = await supabaseClient.from('mrt_meetings').delete().eq('id', meetingId);
        if (error) alert('삭제 실패: ' + error.message);
        else {
            alert('모임이 삭제되었습니다.');
            fetchMeetings();
        }
    }
}

// ------------------- POSTS (게시판 CRUD) -------------------
async function fetchPosts() {
    const listContainer = document.getElementById('board-post-list');
    let query = supabaseClient.from('mrt_posts').select('*').order('created_at', { ascending: false });

    if (activePostCategory !== 'all') query = query.eq('category', activePostCategory);

    const { data: posts, error } = await query;
    if (error || !posts || posts.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #64748b;">게시글이 없습니다. 첫 글을 등록해보세요!</td></tr>';
        return;
    }

    listContainer.innerHTML = posts.map(p => `
        <tr>
            <td>${p.category === 'review' ? '⭐후기' : '🗣️자유'}</td>
            <td onclick="openPostDetail(${p.id})" style="cursor:pointer; font-weight:600;">${p.title}</td>
            <td>${p.author_name}</td>
            <td style="color: #64748b; font-size: 0.85rem;">${new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
            <td><button class="btn btn-danger" onclick="deletePost(${p.id})">삭제</button></td>
        </tr>
    `).join('');
}

async function handleSavePost(e) {
    e.preventDefault();
    const author_name = document.getElementById('post-author').value;
    const category = document.getElementById('post-category').value;
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;

    const { error } = await supabaseClient.from('mrt_posts').insert([{
        author_name, category, title, content
    }]);

    if (error) {
        alert('글 등록 실패: ' + error.message);
    } else {
        alert('게시글이 등록되었습니다!');
        closeModal('modal-post');
        document.getElementById('form-post').reset();
        fetchPosts();
    }
}

async function openPostDetail(postId) {
    const { data: post } = await supabaseClient.from('mrt_posts').select('*').eq('id', postId).single();
    if (!post) return;

    document.getElementById('post-detail-container').innerHTML = `
        <h2 style="font-size: 1.4rem; margin-bottom: 10px;">${post.title}</h2>
        <div style="color: #64748b; font-size: 0.85rem; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
            작성자: <strong>${post.author_name}</strong> | 작성일: ${new Date(post.created_at).toLocaleString('ko-KR')}
        </div>
        <p style="white-space: pre-line; line-height: 1.6;">${post.content}</p>
    `;
    openModal('modal-post-detail');
}

async function deletePost(postId) {
    if (confirm('정말로 이 글을 삭제하시겠습니까?')) {
        const { error } = await supabaseClient.from('mrt_posts').delete().eq('id', postId);
        if (error) alert('삭제 실패: ' + error.message);
        else {
            alert('삭제되었습니다.');
            fetchPosts();
        }
    }
}

// ------------------- EVENT LISTENERS -------------------
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

    document.querySelectorAll('#post-category-filter .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#post-category-filter .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activePostCategory = e.target.dataset.cat;
            fetchPosts();
        });
    });

    document.getElementById('btn-open-meeting-modal').addEventListener('click', () => openModal('modal-meeting'));
    document.getElementById('btn-hero-create').addEventListener('click', () => openModal('modal-meeting'));
    document.getElementById('btn-open-post-modal').addEventListener('click', () => openModal('modal-post'));

    document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.target)));

    document.getElementById('form-meeting').addEventListener('submit', handleSaveMeeting);
    document.getElementById('form-post').addEventListener('submit', handleSavePost);
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
