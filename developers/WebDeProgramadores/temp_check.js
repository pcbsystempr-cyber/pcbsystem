        import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
        const SUPABASE_URL = 'https://hamclpwevqkisaznrchk.supabase.co'
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhbWNscHdldnFraXNhem5yY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MzA2NzUsImV4cCI6MjEwMzUwNjY3NX0.ZEmH587wr3lIHiy9l3DjeCUCe9obHEanmSbv9LpgX44'
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

        const ADMIN_PASSWORD = 'admin123';
        let isAdmin = false;

        function readFileAsBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        function checkAdmin() {
            if (isAdmin) return true;
            const password = prompt('Enter admin password:');
            if (password === ADMIN_PASSWORD) {
                isAdmin = true;
                document.body.classList.add('admin-visible');
                document.getElementById('adminToggle').textContent = 'Logout';
                return true;
            } else if (password !== null) {
                alert('Incorrect password');
            }
            return false;
        }

        document.getElementById('adminToggle').addEventListener('click', function() {
            if (isAdmin) {
                isAdmin = false;
                document.body.classList.remove('admin-visible');
                this.textContent = 'Admin';
            } else {
                checkAdmin();
            }
        });

        document.getElementById('addProgrammerForm').addEventListener('submit', async function(e) {
            if (!checkAdmin()) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            const name = document.getElementById('programmerName').value;
            const role = document.getElementById('programmerRole').value;
            const file = document.getElementById('programmerPhoto').files[0];
            const projectName = document.getElementById('programmerProjectName').value;

            if (!file) {
                alert('Please select a photo');
                return;
            }

            try {
                const photoBase64 = await readFileAsBase64(file);
                const { data, error } = await supabase
                    .from('programmers')
                    .insert([{ name, role, photo: photoBase64 }])
                    .select()
                    .single();

                if (error) throw error;

                const card = document.createElement('div');
                card.className = 'project-card';
                card.setAttribute('data-id', data.id);
                card.setAttribute('data-name', name);
                card.setAttribute('data-role', role);
                card.innerHTML = `
                    <div class="project-image">
                        <img src="${photoBase64}" alt="${name}" style="width:100%;height:100%;object-fit:cover;">
                    </div>
                    <div class="project-content">
                        <h3>${name}</h3>
                        <p class="project-author">${role}</p>
                        <div class="programmer-projects">
                            <h4>Projects:</h4>
                            <ul></ul>
                        </div>
                    </div>
                `;
                document.getElementById('programmersGrid').appendChild(card);
                addAdminButtons(card, 'programmer');

                if (projectName.trim()) {
                    const { data: projectData, error: projectError } = await supabase
                        .from('projects')
                        .insert([{ name: projectName.trim(), programmer: name, description: '' }])
                        .select()
                        .single();

                    if (!projectError && projectData) {
                        const programmerCard = document.querySelector(`.project-card[data-name="${name}"]`);
                        if (programmerCard) {
                            const projectsList = programmerCard.querySelector('.programmer-projects ul');
                            if (projectsList) {
                                const li = document.createElement('li');
                                li.textContent = projectName.trim();
                                projectsList.appendChild(li);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error saving programmer:', error);
                alert('Error saving programmer');
            }

            this.reset();
        });

        document.getElementById('addProjectForm').addEventListener('submit', async function(e) {
            if (!checkAdmin()) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            const name = document.getElementById('projectName').value;
            const programmer = document.getElementById('projectProgrammer').value;
            const description = document.getElementById('projectDescription').value;
            const icon = document.getElementById('projectIcon').value;

            const gradients = [
                'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                'linear-gradient(135deg, #06b6d4 0%, #14b8a6 100%)',
                'linear-gradient(135deg, #22d3ee 0%, #34d399 100%)'
            ];
            const gradient = gradients[Math.floor(Math.random() * gradients.length)];

            try {
                const { data, error } = await supabase
                    .from('projects')
                    .insert([{ name, programmer, description, icon }])
                    .select()
                    .single();

                if (error) throw error;

                const item = document.createElement('div');
                item.className = 'news-card';
                item.setAttribute('data-id', data.id);
                item.innerHTML = `
                    <div class="news-image" style="background: ${gradient};">
                        <span style="font-size:4rem;color:var(--white);">${icon}</span>
                    </div>
                    <div class="news-content">
                        <h4>${name}</h4>
                        <p class="project-author">by ${programmer}</p>
                        <p>${description}</p>
                    </div>
                `;
                document.getElementById('projectsList').appendChild(item);
                addAdminButtons(item, 'project');

                const programmerCard = document.querySelector(`.project-card[data-name="${programmer}"]`);
                if (programmerCard) {
                    const projectsList = programmerCard.querySelector('.programmer-projects ul');
                    if (projectsList) {
                        const li = document.createElement('li');
                        li.textContent = name;
                        projectsList.appendChild(li);
                    }
                }
            } catch (error) {
                console.error('Error saving project:', error);
                alert('Error saving project');
            }

            this.reset();
        });

        document.getElementById('addMediaForm').addEventListener('submit', async function(e) {
            if (!checkAdmin()) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            const type = document.getElementById('mediaType').value;
            const file = document.getElementById('mediaFile').files[0];
            const caption = document.getElementById('mediaCaption').value;

            if (!file) {
                alert('Please select a file');
                return;
            }

            try {
                const src = await readFileAsBase64(file);
                const { data, error } = await supabase
                    .from('media')
                    .insert([{ type, src, caption }])
                    .select()
                    .single();

                if (error) throw error;

                const item = document.createElement('div');
                item.className = 'project-card';
                item.setAttribute('data-id', data.id);

                if (type === 'photo') {
                    item.innerHTML = `
                        <div class="project-image">
                            <img src="${src}" alt="${caption}" style="width:100%;height:100%;object-fit:cover;">
                        </div>
                        <div class="project-content">
                            <p>${caption}</p>
                        </div>
                    `;
                } else {
                    item.innerHTML = `
                        <div class="project-image">
                            <video controls style="width:100%;height:100%;object-fit:cover;">
                                <source src="${src}" type="${file.type}">
                                Your browser does not support the video tag.
                            </video>
                        </div>
                        <div class="project-content">
                            <p>${caption}</p>
                        </div>
                    `;
                }

                const slide = document.createElement('div');
                slide.className = 'media-slide';
                slide.appendChild(item);
                document.getElementById('mediaTrack').appendChild(slide);
                addAdminButtons(item, 'media');
                createMediaDots();
            } catch (error) {
                console.error('Error saving media:', error);
                alert('Error saving media');
            }

            this.reset();
        });

        const initialProjects = [
            { name: 'E-Commerce Platform', programmer: 'Alice Johnson' },
            { name: 'Company Website Redesign', programmer: 'Bob Smith' },
            { name: 'API Gateway Service', programmer: 'Carol Williams' },
            { name: 'CI/CD Pipeline', programmer: 'David Brown' }
        ];

        initialProjects.forEach(project => {
            const programmerCard = document.querySelector(`.project-card[data-name="${project.programmer}"]`);
            if (programmerCard) {
                const projectsList = programmerCard.querySelector('.programmer-projects ul');
                if (projectsList) {
                    const li = document.createElement('li');
                    li.textContent = project.name;
                    projectsList.appendChild(li);
                }
            }
        });

        let currentEditItem = null;
        let currentEditType = null;

        const editModal = document.getElementById('editModal');
        const editModalTitle = document.getElementById('editModalTitle');
        const editModalBody = document.getElementById('editModalBody');
        const saveEditBtn = document.getElementById('saveEditBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');

        function openEditModal(type, item) {
            currentEditType = type;
            currentEditItem = item;
            editModal.classList.add('active');

            if (type === 'programmer') {
                const name = item.getAttribute('data-name');
                const role = item.getAttribute('data-role');
                const imgSrc = item.querySelector('.project-image img')?.src || '';
                editModalTitle.textContent = 'Edit Programmer';
                const projectsList = item.querySelector('.programmer-projects ul');
                const projectsText = Array.from(projectsList.querySelectorAll('li')).map(li => li.textContent).join('\n');
                editModalBody.innerHTML = `
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" id="editName" value="${name}">
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <input type="text" id="editRole" value="${role}">
                    </div>
                    <div class="form-group">
                        <label>Photo</label>
                        <input type="file" id="editPhoto" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label>Projects (one per line)</label>
                        <textarea id="editProjects">${projectsText}</textarea>
                    </div>
                `;
            } else if (type === 'project') {
                const name = item.querySelector('h4')?.textContent || '';
                const author = item.querySelector('.project-author')?.textContent?.replace('by ', '') || '';
                const authorP = item.querySelector('.project-author');
                const description = authorP?.nextElementSibling?.textContent || '';
                const icon = item.querySelector('.news-image span')?.textContent || '💻';
                editModalTitle.textContent = 'Edit Project';
                editModalBody.innerHTML = `
                    <div class="form-group">
                        <label>Project Name</label>
                        <input type="text" id="editProjectName" value="${name}">
                    </div>
                    <div class="form-group">
                        <label>Programmer</label>
                        <input type="text" id="editProjectProgrammer" value="${author}">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="editProjectDescription">${description}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Icon / Emoji</label>
                        <input type="text" id="editProjectIcon" value="${icon}">
                    </div>
                `;
            } else if (type === 'media') {
                const caption = item.querySelector('p')?.textContent || '';
                const img = item.querySelector('img');
                const video = item.querySelector('video');
                const currentSrc = img?.src || video?.querySelector('source')?.src || '';
                editModalTitle.textContent = 'Edit Media';
                editModalBody.innerHTML = `
                    <div class="form-group">
                        <label>Caption</label>
                        <input type="text" id="editMediaCaption" value="${caption}">
                    </div>
                    <div class="form-group">
                        <label>Replace Media</label>
                        <input type="file" id="editMediaFile" accept="image/*,video/*">
                    </div>
                `;
            }
        }

        function closeEditModal() {
            editModal.classList.remove('active');
            currentEditItem = null;
            currentEditType = null;
        }

        saveEditBtn.addEventListener('click', async function() {
            if (!currentEditItem || !currentEditType) return;
            const id = currentEditItem.getAttribute('data-id');

            try {
                if (currentEditType === 'programmer') {
                    const name = document.getElementById('editName').value;
                    const role = document.getElementById('editRole').value;
                    const photoFile = document.getElementById('editPhoto').files[0];

                    const updates = { name, role };
                    if (photoFile) {
                        updates.photo = await readFileAsBase64(photoFile);
                    }

                    const { error } = await supabase.from('programmers').update(updates).eq('id', id);
                    if (error) throw error;

                    currentEditItem.setAttribute('data-name', name);
                    currentEditItem.setAttribute('data-role', role);
                    currentEditItem.querySelector('h3').textContent = name;
                    currentEditItem.querySelector('.project-author').textContent = role;

                    const projectsList = currentEditItem.querySelector('.programmer-projects ul');
                    projectsList.innerHTML = '';
                    const projectsText = document.getElementById('editProjects').value;
                    projectsText.split('\n').filter(p => p.trim()).forEach(p => {
                        const li = document.createElement('li');
                        li.textContent = p.trim();
                        projectsList.appendChild(li);
                    });

                    if (updates.photo) {
                        currentEditItem.querySelector('.project-image img').src = updates.photo;
                    }

                } else if (currentEditType === 'project') {
                    const name = document.getElementById('editProjectName').value;
                    const programmer = document.getElementById('editProjectProgrammer').value;
                    const description = document.getElementById('editProjectDescription').value;
                    const icon = document.getElementById('editProjectIcon').value;

                    const { error } = await supabase.from('projects').update({
                        name,
                        programmer,
                        description,
                        icon
                    }).eq('id', id);
                    if (error) throw error;

                    currentEditItem.querySelector('h4').textContent = name;
                    currentEditItem.querySelector('.project-author').textContent = 'by ' + programmer;
                    currentEditItem.querySelector('.news-content p:not(.project-author)').textContent = description;
                    const newsImageSpan = currentEditItem.querySelector('.news-image span');
                    if (newsImageSpan) {
                        newsImageSpan.textContent = icon;
                    }

                    const oldProgrammer = currentEditItem.getAttribute('data-project-programmer');
                    if (oldProgrammer !== programmer) {
                        const oldCard = document.querySelector(`.project-card[data-name="${oldProgrammer}"]`);
                        const newCard = document.querySelector(`.project-card[data-name="${programmer}"]`);
                        
                        if (oldCard) {
                            const projectsList = oldCard.querySelector('.programmer-projects ul');
                            const items = projectsList.querySelectorAll('li');
                            items.forEach(li => {
                                if (li.textContent === currentEditItem.querySelector('h4').textContent) {
                                    li.remove();
                                }
                            });
                        }

                        if (newCard) {
                            const projectsList = newCard.querySelector('.programmer-projects ul');
                            const li = document.createElement('li');
                            li.textContent = name;
                            projectsList.appendChild(li);
                        }

                        currentEditItem.setAttribute('data-project-programmer', programmer);
                    }

                } else if (currentEditType === 'media') {
                    const caption = document.getElementById('editMediaCaption').value;
                    const mediaFile = document.getElementById('editMediaFile').files[0];

                    let src = null;
                    if (mediaFile) {
                        src = await readFileAsBase64(mediaFile);
                    }

                    const updates = { caption };
                    if (src) {
                        updates.src = src;
                    }

                    const { error } = await supabase.from('media').update(updates).eq('id', id);
                    if (error) throw error;

                    currentEditItem.querySelector('.project-content p').textContent = caption;

                    if (src) {
                        const projectImage = currentEditItem.querySelector('.project-image');
                        if (projectImage) {
                            if (mediaFile.type.startsWith('image/')) {
                                projectImage.innerHTML = '<img src="' + src + '" alt="' + caption + '" style="width:100%;height:100%;object-fit:cover;">';
                            } else if (mediaFile.type.startsWith('video/')) {
                                projectImage.innerHTML = '<video controls style="width:100%;height:100%;object-fit:cover;"><source src="' + src + '" type="' + mediaFile.type + '">Your browser does not support the video tag.</video>';
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error updating:', error);
                alert('Error updating');
            }

            closeEditModal();
        });

        cancelEditBtn.addEventListener('click', closeEditModal);

        function addAdminButtons(card, type) {
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn admin-only';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => openEditModal(type, card));
            card.style.position = 'relative';
            card.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn admin-only';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this?')) {
                    const id = card.getAttribute('data-id');
                    if (id) {
                        const table = type === 'programmer' ? 'programmers' : type === 'project' ? 'projects' : 'media';
                        const { error } = await supabase.from(table).delete().eq('id', id);
                        if (error) {
                            console.error('Error deleting:', error);
                            alert('Error deleting');
                            return;
                        }
                    }

                    if (type === 'media') {
                        const slide = card.closest('.media-slide');
                        if (slide) slide.remove();
                        const slides = getMediaSlides();
                        if (currentMediaIndex >= slides.length) {
                            currentMediaIndex = Math.max(0, slides.length - 1);
                        }
                        createMediaDots();
                    } else if (type === 'programmer') {
                        const name = card.getAttribute('data-name');
                        const option = Array.from(document.getElementById('projectProgrammer').options).find(opt => opt.value === name);
                        if (option) option.remove();
                    }
                    if (type !== 'media' || !card.closest('.media-slide')) {
                        card.remove();
                    }
                }
            });
            card.appendChild(deleteBtn);
        }



        const mediaCarousel = document.getElementById('mediaCarousel');
        const mediaTrack = document.getElementById('mediaTrack');
        const mediaDotsContainer = document.getElementById('mediaDots');
        const mediaPrev = document.getElementById('mediaPrev');
        const mediaNext = document.getElementById('mediaNext');
        let currentMediaIndex = 0;

        function getMediaSlides() {
            return Array.from(mediaTrack.querySelectorAll('.media-slide'));
        }

        function updateMediaCarousel() {
            const slides = getMediaSlides();
            if (!slides.length) return;
            mediaTrack.style.transform = 'translateX(-' + (currentMediaIndex * 100) + '%)';
            slides.forEach((slide, index) => {
                const dot = mediaDotsContainer.children[index];
                if (dot) {
                    dot.classList.toggle('active', index === currentMediaIndex);
                }
            });
        }

        function createMediaDots() {
            const slides = getMediaSlides();
            mediaDotsContainer.innerHTML = '';
            slides.forEach((_, index) => {
                const dot = document.createElement('button');
                dot.className = 'media-dot';
                dot.addEventListener('click', () => {
                    currentMediaIndex = index;
                    updateMediaCarousel();
                });
                mediaDotsContainer.appendChild(dot);
            });
            updateMediaCarousel();
        }

        mediaPrev.addEventListener('click', () => {
            const slides = getMediaSlides();
            currentMediaIndex = (currentMediaIndex - 1 + slides.length) % slides.length;
            updateMediaCarousel();
        });

        mediaNext.addEventListener('click', () => {
            const slides = getMediaSlides();
            currentMediaIndex = (currentMediaIndex + 1) % slides.length;
            updateMediaCarousel();
        });

        createMediaDots();

        let mediaAutoPlay = setInterval(() => {
            const slides = getMediaSlides();
            currentMediaIndex = (currentMediaIndex + 1) % slides.length;
            updateMediaCarousel();
        }, 4000);

        mediaCarousel.addEventListener('mouseenter', () => {
            clearInterval(mediaAutoPlay);
        });

        mediaCarousel.addEventListener('mouseleave', () => {
            mediaAutoPlay = setInterval(() => {
                const slides = getMediaSlides();
                currentMediaIndex = (currentMediaIndex + 1) % slides.length;
                updateMediaCarousel();
            }, 4000);
        });

        async function loadFromSupabase() {
            try {
                const { data: programmers, error: programmersError } = await supabase.from('programmers').select('*');
                if (programmersError) throw programmersError;

                if (programmers && programmers.length > 0) {
                    const grid = document.getElementById('programmersGrid');
                    grid.innerHTML = '';
                    programmers.forEach(p => {
                        const card = document.createElement('div');
                        card.className = 'project-card';
                        card.setAttribute('data-id', p.id);
                        card.setAttribute('data-name', p.name);
                        card.setAttribute('data-role', p.role);
                        card.innerHTML = `
                            <div class="project-image">
                                <img src="${p.photo || 'https://i.pravatar.cc/300?img=1'}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">
                            </div>
                            <div class="project-content">
                                <h3>${p.name}</h3>
                                <p class="project-author">${p.role}</p>
                                <div class="programmer-projects">
                                    <h4>Projects:</h4>
                                    <ul></ul>
                                </div>
                            </div>
                        `;
                        grid.appendChild(card);
                        addAdminButtons(card, 'programmer');
                    });
                }

                const { data: projects, error: projectsError } = await supabase.from('projects').select('*');
                if (projectsError) throw projectsError;

                if (projects && projects.length > 0) {
                    const list = document.getElementById('projectsList');
                    list.querySelectorAll('.news-card').forEach(c => c.remove());

                    projects.forEach(project => {
                        const gradients = [
                            'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                            'linear-gradient(135deg, #06b6d4 0%, #14b8a6 100%)',
                            'linear-gradient(135deg, #22d3ee 0%, #34d399 100%)'
                        ];
                        const gradient = gradients[Math.floor(Math.random() * gradients.length)];
                        const item = document.createElement('div');
                        item.className = 'news-card';
                        item.setAttribute('data-id', project.id);
                        item.innerHTML = `
                            <div class="news-image" style="background: ${gradient};">
                                <span style="font-size:4rem;color:var(--white);">${project.icon || '💻'}</span>
                            </div>
                            <div class="news-content">
                                <h4>${project.name}</h4>
                                <p class="project-author">by ${project.programmer}</p>
                                <p>${project.description || ''}</p>
                            </div>
                        `;
                        list.appendChild(item);
                        addAdminButtons(item, 'project');
                    });

                    const programmerCards = document.querySelectorAll('#programmersGrid .project-card');
                    programmerCards.forEach(card => {
                        const name = card.getAttribute('data-name');
                        const projectsList = card.querySelector('.programmer-projects ul');
                        if (projectsList) {
                            projectsList.innerHTML = '';
                            projects.forEach(project => {
                                if (project.programmer === name) {
                                    const li = document.createElement('li');
                                    li.textContent = project.name;
                                    projectsList.appendChild(li);
                                }
                            });
                        }
                    });
                }

                const { data: media, error: mediaError } = await supabase.from('media').select('*');
                if (mediaError) throw mediaError;

                if (media && media.length > 0) {
                    const track = document.getElementById('mediaTrack');
                    track.querySelectorAll('.media-slide').forEach(s => s.remove());

                    media.forEach(m => {
                        const item = document.createElement('div');
                        item.className = 'project-card';
                        item.setAttribute('data-id', m.id);
                        if (m.type === 'photo') {
                            item.innerHTML = `
                                <div class="project-image">
                                    <img src="${m.src}" alt="${m.caption || ''}" style="width:100%;height:100%;object-fit:cover;">
                                </div>
                                <div class="project-content">
                                    <p>${m.caption || ''}</p>
                                </div>
                            `;
                        } else {
                            item.innerHTML = `
                                <div class="project-image">
                                    <video controls style="width:100%;height:100%;object-fit:cover;">
                                        <source src="${m.src}" type="video/mp4">
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                                <div class="project-content">
                                    <p>${m.caption || ''}</p>
                                </div>
                            `;
                        }
                        const slide = document.createElement('div');
                        slide.className = 'media-slide';
                        slide.appendChild(item);
                        track.appendChild(slide);
                        addAdminButtons(item, 'media');
                    });
                    createMediaDots();
                    updateMediaCarousel();
                }
            } catch (error) {
                console.error('Error loading data from Supabase:', error);
            }
        }

        loadFromSupabase();