/**
 * ComfyUI 软链接配置页面重构脚本
 *
 * 移除了所有硬编码逻辑，改为由 DOM 动态驱动。
 *
 * 主要功能:
 * 1. 动态生成快速跳转导航栏。
 * 2. 动态计算统计数据。
 * 3. 统一的复制逻辑（分类、分组、全部），尊重搜索过滤器。
 * 4. 新增：点击单行命令即可复制。
 * 5. 实时搜索功能。
 */
document.addEventListener('DOMContentLoaded', function () {

    function showAppMessage(message) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);padding:16px;box-sizing:border-box';
        var box = document.createElement('div');
        box.style.cssText = 'max-width:420px;width:100%;background:#fff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;font-family:ui-sans-serif,system-ui,sans-serif';
        var bar = document.createElement('div');
        bar.style.cssText = 'height:4px;background:linear-gradient(90deg,#9333ea,#6366f1)';
        var title = document.createElement('div');
        title.style.cssText = 'padding:20px 20px 8px;font-weight:700;font-size:14px;color:#111827';
        title.textContent = '提示';
        var body = document.createElement('div');
        body.style.cssText = 'padding:8px 20px 16px;font-size:14px;color:#4b5563;white-space:pre-wrap;line-height:1.5';
        body.textContent = message;
        var foot = document.createElement('div');
        foot.style.cssText = 'padding:12px 20px;border-top:1px solid #f3f4f6;display:flex;justify-content:flex-end';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '确定';
        btn.style.cssText = 'padding:8px 20px;border-radius:12px;border:none;background:linear-gradient(90deg,#9333ea,#6366f1);color:#fff;font-weight:600;cursor:pointer;font-size:14px';
        function close() { document.body.removeChild(overlay); }
        btn.onclick = close;
        overlay.onclick = function (e) { if (e.target === overlay) close(); };
        foot.appendChild(btn);
        box.appendChild(bar);
        box.appendChild(title);
        box.appendChild(body);
        box.appendChild(foot);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // -------------------------------------------------------------------------
    // DOM 元素引用
    // -------------------------------------------------------------------------
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const noResults = document.getElementById('noResults');
    const categoryNavList = document.getElementById('categoryNavList');
    const contentTitle = document.getElementById('contentTitle');
    const contentSubtitle = document.getElementById('contentSubtitle');
    const contentBody = document.getElementById('contentBody');
    const introPage = document.getElementById('introPage');
    const sidebar = document.querySelector('.sidebar');

    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileOverlay = document.getElementById('mobileOverlay');

    const allCategories = document.querySelectorAll('.category');
    const allCommandLines = document.querySelectorAll('.command-line');

    // -------------------------------------------------------------------------
    // 初始化函数
    // -------------------------------------------------------------------------

    /**
     * 页面加载时的主初始化函数
     */
    function initializePage() {
        // 从 user_models.json 加载数据（这会动态创建分类）
        loadAllModelsFromFile().then(() => {
            // 重新获取分类列表（因为分类是动态创建的）
            const currentCategories = document.querySelectorAll('.category');
            
            if (!currentCategories.length) {
                console.error('页面上未找到任何 .category 元素，请检查 user_models.json 文件。');
                return;
            }
            
            // 默认隐藏所有分类
            currentCategories.forEach(category => {
                category.classList.add('hidden');
            });
            
            // 初始化导航
            initCategoryNavigation();
            
            addEventListeners();
            
            // 默认显示介绍页面
            showIntroPage();
        }).catch((err) => {
            console.error('加载 user_models.json 失败:', err);
            showAppMessage('无法加载模型数据，请确保 user_models.json 文件存在。');
        });
    }

    /**
     * 动态生成快速跳转导航栏
     */
    function initCategoryNavigation() {
        if (!categoryNavList) return;

        const groups = new Map();

        // 1. 从 DOM 收集分组信息（重新查询以获取最新的分类）
        const currentCategories = document.querySelectorAll('.category');
        const subcategories = new Map(); // 存储子目录，key 是父分类的 domId

        // 第一遍：收集所有分类（包括子目录）
        currentCategories.forEach(category => {
            const categoryId = category.id;
            const categoryDomId = category.getAttribute('data-category-id');
            const titleEl = category.querySelector('.category-title');

            if (!categoryId || !categoryDomId || !titleEl) {
                console.warn('跳过一个不完整的分类：', category);
                return;
            }

            const fullTitle = titleEl.textContent;
            const parentCategory = category.dataset.parentCategory;
            const isSubcategory = category.classList.contains('subcategory');

            // 提取用于导航按钮的显示名称
            let displayName = fullTitle;
            if (displayName.startsWith('/root/ComfyUI/')) {
                displayName = displayName.replace('/root/ComfyUI/', '');
            } else if (displayName.startsWith('/root/')) {
                displayName = displayName.replace('/root/', '');
            }
            if (displayName.includes('/')) {
                displayName = displayName.split('/').pop();
            }

            // 如果是子目录，存储到 subcategories
            // 注意：使用 categoryDomId 作为 key，确保每个父分类的子分类不会重复
            if (isSubcategory && parentCategory) {
                // 验证父分类是否存在且正确
                const parentElement = document.getElementById(`nav-${parentCategory}`);
                if (!parentElement) {
                    console.warn(`子分类 ${categoryId} 的父分类不存在: ${parentCategory}`);
                    return;
                }
                
                // 验证父分类的路径是否匹配
                const parentTitle = parentElement.querySelector('.category-title');
                if (parentTitle) {
                    const parentPath = parentTitle.textContent.trim();
                    // 修复：正确构建期望的父路径（避免双斜杠）
                    const pathParts = fullTitle.split('/').filter(p => p);
                    const expectedParentPath = '/' + pathParts.slice(0, -1).join('/');
                    if (parentPath !== expectedParentPath) {
                        console.warn(`子分类 ${categoryId} 的父分类路径不匹配:`);
                        console.warn(`  子分类路径: ${fullTitle}`);
                        console.warn(`  期望父路径: ${expectedParentPath}`);
                        console.warn(`  实际父路径: ${parentPath}`);
                        return; // 跳过不匹配的子分类
                    }
                }
                
                if (!subcategories.has(parentCategory)) {
                    subcategories.set(parentCategory, []);
                }
                
                // 检查是否已存在相同的子分类（避免重复）
                const existingSub = subcategories.get(parentCategory).find(
                    sub => sub.navId === categoryId || sub.domId === categoryDomId
                );
                if (!existingSub) {
                    subcategories.get(parentCategory).push({
                        navId: categoryId,
                        domId: categoryDomId,
                        fullTitle: fullTitle,
                        displayName: displayName
                    });
                } else {
                    console.warn(`重复的子分类被跳过: ${categoryId} (父分类: ${parentCategory})`);
                }
            }
        });

        // 第二遍：组织主分类和子目录
        currentCategories.forEach(category => {
            const categoryId = category.id;
            const categoryDomId = category.getAttribute('data-category-id');
            const titleEl = category.querySelector('.category-title');

            if (!categoryId || !categoryDomId || !titleEl) {
                return;
            }

            const fullTitle = titleEl.textContent;
            const groupKey = category.dataset.groupKey || 'comfyui';
            const groupName = category.dataset.groupName || 'ComfyUI 默认模型';
            const isSubcategory = category.classList.contains('subcategory');

            // 跳过子目录（已在第一遍处理）
            if (isSubcategory) {
                return;
            }

            // 提取用于导航按钮的显示名称
            let displayName = fullTitle;
            if (displayName.startsWith('/root/ComfyUI/')) {
                displayName = displayName.replace('/root/ComfyUI/', '');
            } else if (displayName.startsWith('/root/')) {
                displayName = displayName.replace('/root/', '');
            }
            if (displayName.includes('/')) {
                displayName = displayName.split('/').pop();
            }

            // 组织数据
            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    name: groupName,
                    key: groupKey,
                    items: []
                });
            }
            groups.get(groupKey).items.push({
                navId: categoryId,
                domId: categoryDomId,
                fullTitle: fullTitle,
                displayName: displayName,
                subcategories: subcategories.get(categoryDomId) || []
            });
        });

        // 2. 对 comfyui 组的 items 按首字母排序
        const comfyuiGroup = groups.get('comfyui');
        if (comfyuiGroup && comfyuiGroup.items.length > 0) {
            comfyuiGroup.items.sort((a, b) => {
                // 获取首字母（中文按拼音首字母，英文按字母）
                const getFirstChar = (str) => {
                    // 如果是英文，直接返回首字母
                    if (/^[a-zA-Z]/.test(str)) {
                        return str.charAt(0).toLowerCase();
                    }
                    // 如果是中文，返回首字符（可以后续扩展拼音排序）
                    return str.charAt(0);
                };
                const charA = getFirstChar(a.displayName);
                const charB = getFirstChar(b.displayName);
                return charA.localeCompare(charB, 'zh-CN');
            });
        }

        // 3. 按固定顺序创建 HTML
        const groupOrder = ['comfyui', 'aux', 'plugin', 'toolkit'];
        categoryNavList.innerHTML = ''; // 清空可能存在的占位符

        // 添加"使用说明"入口
        const introNavItem = document.createElement('div');
        introNavItem.className = 'sidebar-nav-item';
        introNavItem.id = 'introNavItem';
        introNavItem.innerHTML = `
            <span>📖 使用说明</span>
        `;
        introNavItem.title = '查看软链接使用说明';
        introNavItem.addEventListener('click', function() {
            showIntroPage();
        });
        categoryNavList.appendChild(introNavItem);

        // 添加分隔线
        const divider = document.createElement('div');
        divider.style.height = '1px';
        divider.style.background = '#e5e5ea';
        divider.style.margin = '8px 16px';
        categoryNavList.appendChild(divider);

        groupOrder.forEach(groupKey => {
            const group = groups.get(groupKey);
            if (group && group.items.length > 0) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'sidebar-nav-group';
                groupDiv.setAttribute('data-group-key', groupKey);

                // 分组标题
                const groupTitle = document.createElement('div');
                groupTitle.className = 'sidebar-nav-group-title';
                groupTitle.textContent = group.name;
                groupDiv.appendChild(groupTitle);

                // 分组内的导航按钮容器
                const itemsGrid = document.createElement('div');
                itemsGrid.className = 'sidebar-nav-items';

                group.items.forEach(item => {
                    // 主分类项
                    const navItem = document.createElement('div');
                    navItem.className = `sidebar-nav-item`;
                    navItem.dataset.categoryId = item.navId;
                    if (item.subcategories && item.subcategories.length > 0) {
                        navItem.classList.add('has-subcategories');
                        navItem.dataset.hasSubcategories = 'true';
                    }

                    // 获取模型数量
                    const categoryElement = document.getElementById(item.navId);
                    let modelCount = 0;
                    if (categoryElement) {
                        const commandsList = categoryElement.querySelector('.commands-list');
                        if (commandsList) {
                            modelCount = commandsList.querySelectorAll('.command-line').length;
                        }
                    }

                    // 如果有子分类，添加展开/折叠箭头
                    const expandIcon = item.subcategories && item.subcategories.length > 0 
                        ? '<span class="sidebar-nav-expand-icon">▶</span>' 
                        : '';

                    navItem.innerHTML = `
                        <span class="sidebar-nav-item-content">
                            ${expandIcon}
                            <span>${item.displayName}</span>
                        </span>
                        <span class="sidebar-nav-item-count">${modelCount}</span>
                    `;
                    navItem.title = item.fullTitle;
                    itemsGrid.appendChild(navItem);

                    // 如果有子目录，添加子目录项（默认隐藏）
                    if (item.subcategories && item.subcategories.length > 0) {
                        const subcategoryContainer = document.createElement('div');
                        subcategoryContainer.className = 'sidebar-nav-subcategories';
                        subcategoryContainer.style.display = 'none'; // 默认隐藏
                        // 添加 data-parent-nav-id 属性，用于快速查找对应的父导航项
                        subcategoryContainer.dataset.parentNavId = item.navId;

                        item.subcategories.forEach(subItem => {
                            const subNavItem = document.createElement('div');
                            subNavItem.className = `sidebar-nav-item sidebar-nav-subitem`;
                            subNavItem.dataset.categoryId = subItem.navId;

                            // 获取子目录模型数量
                            const subCategoryElement = document.getElementById(subItem.navId);
                            let subModelCount = 0;
                            if (subCategoryElement) {
                                const subCommandsList = subCategoryElement.querySelector('.commands-list');
                                if (subCommandsList) {
                                    subModelCount = subCommandsList.querySelectorAll('.command-line').length;
                                }
                            }

                            subNavItem.innerHTML = `
                                <span>${subItem.displayName}</span>
                                <span class="sidebar-nav-item-count">${subModelCount}</span>
                            `;
                            subNavItem.title = subItem.fullTitle;
                            subcategoryContainer.appendChild(subNavItem);
                        });

                        // 将子分类容器紧跟在主分类项之后
                        itemsGrid.appendChild(subcategoryContainer);
                    }
                });

                groupDiv.appendChild(itemsGrid);
                categoryNavList.appendChild(groupDiv);
            }
        });
    }


    /**
     * 为所有动态和静态元素绑定事件监听器
     */
    function addEventListeners() {
        // 搜索框
        searchInput.addEventListener('input', handleSearchInput);
        searchClear.addEventListener('click', clearSearch);
        
        // 移动端菜单切换
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', toggleMobileMenu);
        }
        
        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', closeMobileMenu);
        }
        
        // 点击分类项时，在移动端自动关闭菜单
        categoryNavList.addEventListener('click', function (e) {
            const target = e.target.closest('.sidebar-nav-item');
            if (target && window.innerWidth <= 768) {
                setTimeout(() => {
                    closeMobileMenu();
                }, 300);
            }
        });

        // 导航栏事件委托
        categoryNavList.addEventListener('click', function (e) {
            const target = e.target.closest('.sidebar-nav-item');
            if (!target) return;

            const categoryId = target.dataset.categoryId;
            if (!categoryId) return;

            // 检查是否是子分类项
            const isSubItem = target.classList.contains('sidebar-nav-subitem');
            
            // 如果是父分类且有子分类，先展开/折叠子分类列表
            if (!isSubItem && target.dataset.hasSubcategories === 'true') {
                toggleSubcategories(target);
            }
            
            // 显示分类内容（无论是父分类还是子分类）
            toggleCategoryVisibility(categoryId, target);
        });

        // 分类事件委托（复制分类）
        contentBody.addEventListener('click', function (e) {
            // 点击 "复制" 按钮
            if (e.target.classList.contains('btn-copy')) {
                const categoryId = e.target.dataset.copyTarget;
                if (categoryId) {
                    copyCategory(categoryId, e.target);
                }
            }

            // 点击单行命令
            if (e.target.classList.contains('command-line')) {
                copySingleLine(e.target);
            }
        });
    }

    // -------------------------------------------------------------------------
    // 搜索功能
    // -------------------------------------------------------------------------

    /**
     * 处理搜索框输入
     */
    function handleSearchInput() {
        const searchTerm = searchInput.value.trim().toLowerCase();

        // 控制清除按钮的显示
        if (searchTerm.length > 0) {
            searchClear.classList.add('show');
        } else {
            searchClear.classList.remove('show');
        }

        performSearch(searchTerm);
    }

    /**
     * 执行搜索和 DOM 过滤
     * @param {string} searchTerm - 搜索关键词
     */
    function performSearch(searchTerm) {
        let visibleCount = 0;
        const currentCategories = document.querySelectorAll('.category');

        currentCategories.forEach(category => {
            // 搜索词为空，恢复默认状态（显示介绍页面或选中的分类）
            if (searchTerm === '') {
                // 检查是否有选中的按钮
                const activeButton = document.querySelector('.sidebar-nav-item.active');
                if (activeButton) {
                    const activeCategoryId = activeButton.dataset.categoryId;
                    const categoryId = category.id;
                    if (categoryId === activeCategoryId) {
                        category.classList.remove('hidden');
                        if (introPage) {
                            introPage.classList.add('hidden');
                        }
                    } else {
                        category.classList.add('hidden');
                    }
                } else {
                    // 没有选中按钮时，显示介绍页面
                    category.classList.add('hidden');
                    if (introPage) {
                        introPage.classList.remove('hidden');
                    }
                }
                category.querySelectorAll('.command-line').forEach(line => {
                    line.classList.remove('hidden');
                });
                if (!category.classList.contains('hidden')) {
                    visibleCount++;
                }
                return;
            }

            // 搜索词不为空，显示所有匹配的分类
            const categoryTitle = category.querySelector('.category-title').textContent.toLowerCase();
            const commandLines = category.querySelectorAll('.command-line');

            let categoryMatches = categoryTitle.includes(searchTerm);
            let hasMatchingCommands = false;

            commandLines.forEach(line => {
                const lineText = line.textContent.toLowerCase();
                const matches = lineText.includes(searchTerm);

                if (matches) {
                    hasMatchingCommands = true;
                    line.classList.remove('hidden'); // 匹配的行显示
                } else {
                    // 如果分类标题匹配，则显示该分类下的所有行
                    if (categoryMatches) {
                        line.classList.remove('hidden');
                    } else {
                        line.classList.add('hidden'); // 不匹配的行隐藏
                    }
                }
            });

            // 如果分类标题匹配，或者分类下有匹配的命令，则显示该分类
            if (categoryMatches || hasMatchingCommands) {
                category.classList.remove('hidden');
                visibleCount++;
            } else {
                category.classList.add('hidden');
            }
        });

        // 如果有搜索结果，隐藏介绍页面
        if (searchTerm !== '' && visibleCount > 0) {
            if (introPage) {
                introPage.classList.add('hidden');
            }
        }

        // 更新 "未找到结果" 的显示状态
        noResults.classList.toggle('show', visibleCount === 0 && searchTerm !== '');
    }

    /**
     * 清除搜索框内容并重置过滤
     */
    function clearSearch() {
        searchInput.value = '';
        handleSearchInput();
    }

    // -------------------------------------------------------------------------
    // 滚动功能
    // -------------------------------------------------------------------------

    /**
     * 切换子分类的展开/折叠
     * @param {HTMLElement} parentNavItem - 父分类导航项
     */
    function toggleSubcategories(parentNavItem) {
        // 方法1：尝试使用 nextElementSibling 找到紧跟在主分类项之后的子分类容器
        let subcategoryContainer = parentNavItem.nextElementSibling;
        
        // 如果 nextElementSibling 不是子分类容器，则使用方法2：通过 data-parent-nav-id 查找
        if (!subcategoryContainer || !subcategoryContainer.classList.contains('sidebar-nav-subcategories')) {
            const categoryId = parentNavItem.dataset.categoryId;
            if (categoryId) {
                // 在父容器中查找匹配的子分类容器
                const parentContainer = parentNavItem.parentElement;
                subcategoryContainer = parentContainer.querySelector(`.sidebar-nav-subcategories[data-parent-nav-id="${categoryId}"]`);
            }
        }
        
        // 如果还是找不到，尝试在父容器中查找第一个子分类容器（向后兼容）
        if (!subcategoryContainer) {
            const parentItemContainer = parentNavItem.parentElement;
            subcategoryContainer = parentItemContainer.querySelector('.sidebar-nav-subcategories');
        }
        
        if (!subcategoryContainer) {
            console.warn('未找到子分类容器，父分类项:', parentNavItem);
            return;
        }
        
        const isExpanded = subcategoryContainer.style.display !== 'none';
        const expandIcon = parentNavItem.querySelector('.sidebar-nav-expand-icon');
        
        if (isExpanded) {
            // 折叠
            subcategoryContainer.style.display = 'none';
            if (expandIcon) {
                expandIcon.textContent = '▶';
                expandIcon.style.transform = 'rotate(0deg)';
            }
            parentNavItem.classList.remove('expanded');
        } else {
            // 展开
            subcategoryContainer.style.display = 'block';
            if (expandIcon) {
                expandIcon.textContent = '▼';
                expandIcon.style.transform = 'rotate(0deg)';
            }
            parentNavItem.classList.add('expanded');
        }
    }

    /**
     * 切换分类的显示/隐藏状态
     * @param {string} categoryId - .category 元素的 ID (e.g., "nav-category-1")
     * @param {HTMLElement} button - 被点击的导航按钮
     */
    function toggleCategoryVisibility(categoryId, button) {
        // 调试：检查是否有多个元素有相同的 ID
        const allElementsWithId = document.querySelectorAll(`#${categoryId}`);
        if (allElementsWithId.length > 1) {
            console.error(`⚠️ 发现 ${allElementsWithId.length} 个元素有相同的 ID: ${categoryId}`);
            allElementsWithId.forEach((el, index) => {
                const title = el.querySelector('.category-title');
                console.error(`  元素 ${index + 1}: ${title ? title.textContent : '无标题'}`);
            });
        }
        
        const categoryElement = document.getElementById(categoryId);
        if (!categoryElement) {
            console.error(`未找到 ID 为 ${categoryId} 的元素`);
            return;
        }
        
        // 验证：确保找到的元素是正确的（通过检查按钮的 title 属性）
        if (button && button.title) {
            const expectedPath = button.title.trim();
            const actualTitle = categoryElement.querySelector('.category-title');
            if (actualTitle && actualTitle.textContent.trim() !== expectedPath) {
                console.error(`⚠️ 分类不匹配:`);
                console.error(`  期望: ${expectedPath}`);
                console.error(`  实际: ${actualTitle.textContent.trim()}`);
                console.error(`  使用的 ID: ${categoryId}`);
                // 尝试通过路径查找正确的元素
                const correctElement = Array.from(document.querySelectorAll('.category')).find(cat => {
                    const title = cat.querySelector('.category-title');
                    return title && title.textContent.trim() === expectedPath;
                });
                if (correctElement) {
                    console.log(`找到正确的元素，使用其 ID: ${correctElement.id}`);
                    return toggleCategoryVisibility(correctElement.id, button);
                }
            }
        }

        // 隐藏介绍页面
        if (introPage) {
            introPage.classList.add('hidden');
        }

        // 隐藏所有分类
        const currentCategories = document.querySelectorAll('.category');
        currentCategories.forEach(cat => {
            cat.classList.add('hidden');
        });

        // 移除所有按钮的选中状态（包括使用说明按钮）
        document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
            btn.classList.remove('active');
        });

        // 检查是否是子分类
        const isSubcategory = categoryElement.classList.contains('subcategory');
        
        if (isSubcategory) {
            // 如果是子分类，只显示子分类，不显示父分类
            categoryElement.classList.remove('hidden');
            if (button) {
                button.classList.add('active');
            }
        } else {
            // 如果是主分类，显示主分类及其子分类
            categoryElement.classList.remove('hidden');
            if (button) {
                button.classList.add('active');
            }

            // 显示其子分类
            const categoryDomId = categoryElement.getAttribute('data-category-id');
            if (categoryDomId) {
                const subcategories = document.querySelectorAll(`.category[data-parent-category="${categoryDomId}"]`);
                subcategories.forEach(subcat => {
                    subcat.classList.remove('hidden');
                });
            }
        }

        // 更新右侧标题
        updateContentHeader(categoryElement);

        // 滚动到顶部
        contentBody.scrollTop = 0;
    }


    /**
     * 应用斑马纹效果到命令列表
     * @param {HTMLElement} commandsList - 命令列表元素
     */
    function applyZebraStriping(commandsList) {
        if (!commandsList) return;
        
        // 先移除所有斑马纹类（包括隐藏的元素）
        const allWrappers = commandsList.querySelectorAll('.command-line-wrapper');
        allWrappers.forEach(wrapper => {
            wrapper.classList.remove('zebra-odd', 'zebra-even');
        });
        const allDirectLines = commandsList.querySelectorAll('.command-line');
        allDirectLines.forEach(line => {
            line.classList.remove('zebra-odd', 'zebra-even');
        });
        
        // 只对可见的元素重新计算斑马纹
        // 获取所有可见的包装容器（按 DOM 顺序）
        const visibleWrappers = Array.from(commandsList.children).filter(child => {
            if (child.classList.contains('command-line-wrapper')) {
                return !child.classList.contains('hidden');
            }
            return false;
        });
        
        visibleWrappers.forEach((wrapper, index) => {
            if ((index + 1) % 2 === 1) {
                wrapper.classList.add('zebra-odd');
            } else {
                wrapper.classList.add('zebra-even');
            }
        });
        
        // 处理直接作为子元素的 command-line（HTML 原始结构，不在 wrapper 中）
        const visibleDirectLines = Array.from(commandsList.children).filter(child => {
            if (child.classList.contains('command-line') && !child.closest('.command-line-wrapper')) {
                return !child.classList.contains('hidden');
            }
            return false;
        });
        
        visibleDirectLines.forEach((line, index) => {
            if ((index + 1) % 2 === 1) {
                line.classList.add('zebra-odd');
            } else {
                line.classList.add('zebra-even');
            }
        });
    }

    /**
     * 显示介绍页面
     */
    function showIntroPage() {
        if (introPage) {
            introPage.classList.remove('hidden');
        }
        if (contentTitle && contentSubtitle) {
            contentTitle.textContent = 'ComfyUI 模型软链接使用';
            contentSubtitle.textContent = '了解如何使用软链接来管理模型文件';
        }
        // 隐藏所有分类
        const currentCategories = document.querySelectorAll('.category');
        currentCategories.forEach(cat => {
            cat.classList.add('hidden');
        });
        // 移除所有按钮的选中状态（除了使用说明按钮）
        document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
            if (btn.id !== 'introNavItem') {
                btn.classList.remove('active');
            }
        });
        // 高亮使用说明按钮
        const introNavItem = document.getElementById('introNavItem');
        if (introNavItem) {
            introNavItem.classList.add('active');
        }
    }

    /**
     * 更新右侧内容标题
     * @param {HTMLElement} categoryElement - 分类元素
     */
    function updateContentHeader(categoryElement) {
        if (!categoryElement || !contentTitle || !contentSubtitle) return;

        const titleEl = categoryElement.querySelector('.category-title');
        const infoEl = categoryElement.querySelector('.category-info');

        if (titleEl) {
            contentTitle.textContent = titleEl.textContent;
        }
        if (infoEl) {
            contentSubtitle.textContent = infoEl.textContent;
        }
    }

    /**
     * 平滑滚动到指定 ID 的分类
     * @param {string} categoryNavId - .category 元素的 ID (e.g., "nav-category-1")
     */
    function scrollToCategory(categoryNavId) {
        const element = document.getElementById(categoryNavId);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

            // 添加高亮效果
            const header = element.querySelector('.category-header');
            if (header) {
                header.classList.add('highlight');
                setTimeout(() => {
                    header.classList.remove('highlight');
                }, 1500);
            }
        }
    }

    // -------------------------------------------------------------------------
    // 复制功能
    // -------------------------------------------------------------------------

    /**
     * 从指定分类中获取所有可见命令
     * @param {string} categoryId - .commands-list 元素的 ID (e.g., "category-1")
     * @returns {string} - 格式化后的命令字符串
     */
    function getVisibleCommandsFromCategory(categoryId) {
        const element = document.getElementById(categoryId);
        if (!element) return '';

        // 查找所有 *未被隐藏* 的 .command-line 元素
        const commandLines = element.querySelectorAll('.command-line:not(.hidden)');

        return Array.from(commandLines)
            .map(line => line.textContent.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    /**
     * 复制单个分类的可见命令
     * @param {string} categoryId - .commands-list 元素的 ID (e.g., "category-1")
     * @param {HTMLElement} button - 被点击的按钮
     */
    function copyCategory(categoryId, button) {
        const text = getVisibleCommandsFromCategory(categoryId);
        if (!text) return;

        copyToClipboard(text, () => {
            showButtonCopySuccess(button);
        });
    }

    /**
     * 复制一个分组的所有可见命令
     * @param {string} groupKey - 分组的 key (e.g., "comfyui")
     * @param {HTMLElement} button - 被点击的按钮
     */
    function copyGroupCommands(groupKey, button) {
        const allCommands = [];
        // 查找所有属于该组的 *未被隐藏* 的分类
        const categoriesInGroup = document.querySelectorAll(
            `.category[data-group-key="${groupKey}"]:not(.hidden)`
        );

        categoriesInGroup.forEach(category => {
            const categoryId = category.dataset.categoryId;
            if (categoryId) {
                const commands = getVisibleCommandsFromCategory(categoryId);
                if (commands) {
                    allCommands.push(commands);
                }
            }
        });

        const text = allCommands.join('\n');
        if (!text) return;

        copyToClipboard(text, () => {
            showButtonCopySuccess(button);
        });
    }

    /**
     * 复制页面上所有可见的命令
     * @param {HTMLElement} button - 被点击的按钮
     */
    function copyAllVisibleCommands(button) {
        const allCommands = [];
        // 查找所有 *未被隐藏* 的分类
        const visibleCategories = document.querySelectorAll('.category:not(.hidden)');

        visibleCategories.forEach(category => {
            const categoryId = category.dataset.categoryId;
            if (categoryId) {
                const commands = getVisibleCommandsFromCategory(categoryId);
                if (commands) {
                    allCommands.push(commands);
                }
            }
        });

        const text = allCommands.join('\n');
        if (!text) return;

        copyToClipboard(text, () => {
            showButtonCopySuccess(button);
        });
    }

    /**
     * 切换移动端菜单
     */
    function toggleMobileMenu() {
        if (sidebar && mobileOverlay) {
            const isOpen = sidebar.classList.contains('mobile-open');
            if (isOpen) {
                closeMobileMenu();
            } else {
                openMobileMenu();
            }
        }
    }

    /**
     * 打开移动端菜单
     */
    function openMobileMenu() {
        if (!sidebar || !mobileOverlay) return;
        sidebar.classList.add('mobile-open');
        mobileOverlay.classList.add('show');
        mobileOverlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    /**
     * 关闭移动端菜单
     */
    function closeMobileMenu() {
        if (!sidebar || !mobileOverlay) return;
        sidebar.classList.remove('mobile-open');
        mobileOverlay.classList.remove('show');
        setTimeout(() => {
            mobileOverlay.style.display = 'none';
        }, 300);
        document.body.style.overflow = '';
    }


    /**
     * 显示 Toast 通知
     * @param {string} message - 提示消息
     */
    function showToast(message) {
        // 移除已存在的 toast
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        // 创建新的 toast
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        // 触发显示动画
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // 3秒后自动移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 2000);
    }

    /**
     * 复制单行命令
     * @param {HTMLElement} lineElement - 被点击的 .command-line 元素
     */
    function copySingleLine(lineElement) {
        const text = lineElement.textContent.trim();
        if (!text) return;

        copyToClipboard(text, () => {
            // 显示单行复制成功的效果（整条变绿，右侧显示"已复制"）
            lineElement.classList.add('copied-line');
            setTimeout(() => {
                lineElement.classList.remove('copied-line');
            }, 2000);
        });
    }

    /**
     * 核心剪贴板复制函数
     * @param {string} text - 要复制的文本
     * @param {function} onSuccess - 成功后的回调
     */
    function copyToClipboard(text, onSuccess) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(onSuccess).catch(err => {
                console.error('使用 Clipboard API 复制失败:', err);
                fallbackCopy(text, onSuccess);
            });
        } else {
            console.warn('Clipboard API 不可用，降级到 execCommand');
            fallbackCopy(text, onSuccess);
        }
    }

    /**
     * 降级复制方案 (用于旧版浏览器或 http 环境)
     * @param {string} text - 要复制的文本
     * @param {function} onSuccess - 成功后的回调
     */
    function fallbackCopy(text, onSuccess) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                onSuccess();
            } else {
                console.error('fallbackCopy: execCommand 失败');
            }
        } catch (err) {
            console.error('fallbackCopy: 复制时发生错误', err);
        }

        document.body.removeChild(textArea);
    }

    /**
     * 显示按钮复制成功的状态
     * @param {HTMLElement} button - 目标按钮
     */
    function showButtonCopySuccess(button) {
        const originalText = button.textContent;

        button.textContent = '已复制';
        button.classList.add('copied');

        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }

    // -------------------------------------------------------------------------
    // 添加模型功能
    // -------------------------------------------------------------------------


    /**
     * 从 user_models.json 加载所有模型数据
     */
    async function loadAllModelsFromFile() {
        try {
            const resp = await fetch('user_models.json', { cache: 'no-cache' });
            if (!resp.ok) {
                // 文件不存在，使用HTML中的原始数据
                console.log('user_models.json 不存在，使用HTML中的原始数据');
                return Promise.resolve();
            }
            const data = await resp.json();
            // 根据 user_models.json 动态创建分类结构
            createCategoriesFromUserModels2(data);
            // 转换 user_models.json 的数据格式为页面需要的格式
            const convertedData = convertUserModels2Data(data);
            applyAllModelsData(convertedData);
            return Promise.resolve();
        } catch (err) {
            // 静默忽略（可能是 file:// 或 CORS 限制）
            console.log('无法加载 user_models.json，使用HTML中的原始数据', err);
            return Promise.reject(err);
        }
    }

    /**
     * 根据 user_models.json 动态创建分类 HTML 结构
     * @param {Object} data - user_models.json 的数据
     */
    function createCategoriesFromUserModels2(data) {
        if (!data || !data.categories) {
            return;
        }

        const categoriesContainer = document.getElementById('categoriesContainer');
        if (!categoriesContainer) {
            console.error('找不到 categoriesContainer 元素');
            return;
        }

        // 清空现有分类
        categoriesContainer.innerHTML = '';

        const categoryIdMap = new Map(); // 路径到 category-id 的映射

        // 根据路径判断 group-key 和 group-name
        function getGroupInfo(path) {
            if (path.startsWith('/root/ComfyUI/custom_nodes/')) {
                return { key: 'aux', name: 'Aux 插件' };
            } else if (path.startsWith('/root/ComfyUI/models/')) {
                return { key: 'comfyui', name: 'ComfyUI 默认模型' };
            } else if (path.startsWith('/root/autodl-tmp/') || path.startsWith('/root/Wan2.2-Animate-14B')) {
                return { key: 'toolkit', name: 'AI-Toolkit 训练类' };
            } else {
                return { key: 'plugin', name: '独立插件' };
            }
        }

        // 判断是否是子分类（通过检查路径是否包含父路径）
        // 动态检测：如果路径的父目录存在于所有分类中，则它是子分类
        function isSubcategory(path) {
            // 提取父路径（去掉最后一个路径段）
            const pathParts = path.split('/').filter(p => p);
            if (pathParts.length <= 1) {
                return false; // 根路径或单级路径不是子分类
            }
            
            // 构建可能的父路径
            const parentPath = '/' + pathParts.slice(0, -1).join('/');
            
            // 检查父路径是否存在于所有分类数据中
            // 注意：这里需要检查 allCategoryData，但此时可能还没有构建，所以先检查 categoryIdMap
            // 如果父路径在 categoryIdMap 中，说明它是已存在的分类
            return categoryIdMap.has(parentPath) || 
                   allCategoryData.some(cat => cat.path === parentPath);
        }

        // 获取父分类路径和 ID（用于子分类）
        // 动态检测：根据路径提取父路径，然后查找对应的分类
        function getParentCategoryInfo(path) {
            // 提取父路径（去掉最后一个路径段）
            const pathParts = path.split('/').filter(p => p);
            if (pathParts.length <= 1) {
                return null; // 没有父路径
            }
            
            // 构建父路径
            const parentPath = '/' + pathParts.slice(0, -1).join('/');
            
            // 查找父分类的 ID（使用路径映射）
            const parentId = categoryIdMap.get(parentPath);
            if (parentId) {
                return {
                    path: parentPath,
                    id: parentId
                };
            }
            
            // 如果找不到，尝试从 allCategoryData 中查找
            const parentCategory = allCategoryData.find(cat => cat.path === parentPath);
            if (parentCategory) {
                return {
                    path: parentPath,
                    id: parentCategory.categoryId
                };
            }
            
            return null;
        }

        // 将路径转换为安全的 ID（移除特殊字符，使用连字符）
        function pathToId(path) {
            // 移除开头的斜杠，替换所有斜杠和特殊字符为连字符
            return path
                .replace(/^\//, '')  // 移除开头的斜杠
                .replace(/\//g, '-')  // 替换斜杠为连字符
                .replace(/[^a-zA-Z0-9-]/g, '-')  // 替换其他特殊字符为连字符
                .replace(/-+/g, '-')  // 合并多个连字符为一个
                .replace(/^-|-$/g, '');  // 移除开头和结尾的连字符
        }

        // 生成 category-id（基于路径，而不是索引）
        function generateCategoryId(path, categoryKey) {
            // 使用路径生成 ID，确保唯一性和稳定性
            const baseId = `category-${pathToId(path)}`;
            return baseId;
        }

        // 第一步：收集所有分类，先建立路径映射（不区分主分类和子分类）
        const allCategoryData = [];
        const parentPathsNeeded = new Set(); // 需要创建的父分类路径
        const usedCategoryIds = new Set(); // 跟踪已使用的 category-id，确保唯一性

        Object.keys(data.categories).forEach(categoryKey => {
            const category = data.categories[categoryKey];
            if (!category || !category.mkdir) {
                return;
            }

            const path = category.mkdir.replace('mkdir -p ', '').trim();
            const fileCount = category.files ? category.files.length : 0;
            const groupInfo = getGroupInfo(path);
            let categoryId = generateCategoryId(path, categoryKey);
            
            // 确保 category-id 唯一
            let originalCategoryId = categoryId;
            let attemptCount = 0;
            while (usedCategoryIds.has(categoryId)) {
                attemptCount++;
                categoryId = `${originalCategoryId}-${attemptCount}`;
                console.warn(`检测到重复的 category-id: ${originalCategoryId}，使用 ${categoryId} 代替`);
            }
            usedCategoryIds.add(categoryId);

            const categoryData = {
                key: categoryKey,
                path: path,
                categoryId: categoryId,
                groupKey: groupInfo.key,
                groupName: groupInfo.name,
                fileCount: fileCount,
                mkdir: category.mkdir,
                files: category.files || []
            };

            // 建立路径映射（先建立所有映射，包括可能的子分类）
            categoryIdMap.set(path, categoryId);
            allCategoryData.push(categoryData);
        });
        
        // 第二步：检测所有可能的父子关系，记录需要的父路径
        // 注意：不要创建中间路径如 /root/ComfyUI/models，只创建实际需要的父分类
        allCategoryData.forEach(categoryData => {
            const pathParts = categoryData.path.split('/').filter(p => p);
            if (pathParts.length > 1) {
                // 构建可能的父路径
                const parentPath = '/' + pathParts.slice(0, -1).join('/');
                
                // 跳过中间路径，只处理实际需要的父分类
                // 例如：跳过 /root, /root/ComfyUI, /root/ComfyUI/models 等中间路径
                // 只创建如 /root/ComfyUI/models/BiRefNet 这样的实际分类路径
                if (parentPath.startsWith('/root/ComfyUI/models/') || 
                    parentPath.startsWith('/root/autodl-tmp/') ||
                    parentPath.startsWith('/root/Wan2.2-Animate-14B') ||
                    parentPath.startsWith('/root/ComfyUI/custom_nodes/')) {
                    // 检查父路径是否存在
                    const parentExists = allCategoryData.some(cat => cat.path === parentPath);
                    if (!parentExists) {
                        // 如果父路径不存在，记录需要创建
                        parentPathsNeeded.add(parentPath);
                    }
                }
            }
        });

        // 第二步：为需要的父路径创建父分类（如果不存在）
        parentPathsNeeded.forEach(parentPath => {
            // 检查父分类是否已存在
            const parentExists = allCategoryData.some(cat => cat.path === parentPath);
            if (!parentExists) {
                const parentGroupInfo = getGroupInfo(parentPath);
                const parentKey = parentPath.split('/').pop();
                
                // 使用基于路径的 ID 生成
                let parentCategoryId = generateCategoryId(parentPath, parentKey);
                
                // 确保 ID 唯一
                let originalCategoryId = parentCategoryId;
                let attemptCount = 0;
                while (usedCategoryIds.has(parentCategoryId)) {
                    attemptCount++;
                    parentCategoryId = `${originalCategoryId}-${attemptCount}`;
                }
                usedCategoryIds.add(parentCategoryId);
                categoryIdMap.set(parentPath, parentCategoryId);
                
                const parentCategoryData = {
                    key: parentKey,
                    path: parentPath,
                    categoryId: parentCategoryId,
                    groupKey: parentGroupInfo.key,
                    groupName: parentGroupInfo.name,
                    fileCount: 0,
                    mkdir: `mkdir -p ${parentPath}`,
                    files: []
                };
                
                allCategoryData.push(parentCategoryData);
                console.log(`自动创建父分类: ${parentPath} (${parentCategoryId})`);
            }
        });

        // 第四步：区分主分类和子分类，建立父子关系（在创建所有父分类之后）
        // 规则：以 /root/ComfyUI/models 为基准，判断分类层级
        const basePath = '/root/ComfyUI/models';
        const mainCategories = [];
        const subCategoriesMap = new Map(); // key: parentCategoryId, value: subcategories array
        const processedSubcategories = new Set(); // 记录已处理的子分类，避免重复

        // 计算路径相对于基准路径的深度
        function getPathDepth(path) {
            if (!path.startsWith(basePath)) {
                // 对于非 ComfyUI/models 路径，使用其他基准
                if (path.startsWith('/root/autodl-tmp/')) {
                    return path.replace('/root/autodl-tmp/', '').split('/').filter(p => p).length;
                } else if (path.startsWith('/root/Wan2.2-Animate-14B')) {
                    return 1; // 特殊处理
                } else if (path.startsWith('/root/ComfyUI/custom_nodes/')) {
                    return path.replace('/root/ComfyUI/custom_nodes/', '').split('/').filter(p => p).length;
                }
                return path.split('/').filter(p => p).length;
            }
            // 相对于 /root/ComfyUI/models 的深度
            const relativePath = path.replace(basePath, '').replace(/^\//, '');
            if (!relativePath) return 0; // 就是 /root/ComfyUI/models 本身
            return relativePath.split('/').filter(p => p).length;
        }

        // 先处理所有分类，确保每个分类只被处理一次
        allCategoryData.forEach(categoryData => {
            // 跳过已处理的子分类
            if (processedSubcategories.has(categoryData.path)) {
                return;
            }
            
            const pathDepth = getPathDepth(categoryData.path);
            
            if (pathDepth <= 1) {
                // 深度为0或1，这是主分类（一级分类）
                mainCategories.push(categoryData);
            } else {
                // 深度大于1，这是子分类（二级或更深）
                // 构建父路径
                const pathParts = categoryData.path.split('/').filter(p => p);
                const parentPath = '/' + pathParts.slice(0, -1).join('/');
                
                // 检查父路径是否是中间路径（不应该作为分类的路径）
                const isIntermediatePath = (
                    parentPath === '/root' ||
                    parentPath === '/root/ComfyUI' ||
                    parentPath === '/root/ComfyUI/models' ||
                    parentPath === '/root/ComfyUI/custom_nodes' ||
                    parentPath === '/root/autodl-tmp'
                );
                
                if (isIntermediatePath) {
                    // 中间路径，这是主分类（一级分类）
                    mainCategories.push(categoryData);
                } else {
                    // 查找父分类（现在应该能找到，因为已经创建了所有需要的父分类）
                    const parentCategory = allCategoryData.find(cat => cat.path === parentPath);
                    
                    if (parentCategory) {
                        // 找到父分类，这是子分类（二级分类）
                        const actualParentId = parentCategory.categoryId;
                        categoryData.parentCategoryId = actualParentId;
                        categoryData.parentPath = parentPath;
                        
                        // 将子分类按父分类分组（使用实际的父分类ID）
                        if (!subCategoriesMap.has(actualParentId)) {
                            subCategoriesMap.set(actualParentId, []);
                        }
                        // 检查是否已存在相同的子分类（避免重复）
                        const existingSub = subCategoriesMap.get(actualParentId).find(
                            sub => sub.path === categoryData.path
                        );
                        if (!existingSub) {
                            subCategoriesMap.get(actualParentId).push(categoryData);
                            processedSubcategories.add(categoryData.path);
                        } else {
                            console.warn(`重复的子分类被跳过: ${categoryData.path}`);
                        }
                    } else {
                        // 没有找到父分类，这是主分类（一级分类）
                        mainCategories.push(categoryData);
                    }
                }
            }
        });
        
        // 在创建分类之前，检查并修复重复的 category-id
        const categoryIdCounts = new Map();
        allCategoryData.forEach(cat => {
            const count = categoryIdCounts.get(cat.categoryId) || 0;
            categoryIdCounts.set(cat.categoryId, count + 1);
        });
        const duplicateIds = Array.from(categoryIdCounts.entries()).filter(([id, count]) => count > 1);
        if (duplicateIds.length > 0) {
            console.error('❌ 发现重复的 category-id:');
            duplicateIds.forEach(([id, count]) => {
                const cats = allCategoryData.filter(c => c.categoryId === id);
                console.error(`   ${id}: ${count} 个分类`);
                cats.forEach((cat, index) => {
                    console.error(`      ${index + 1}. ${cat.path}`);
                });
            });
            
            // 修复重复的 category-id
            console.log('🔧 开始修复重复的 category-id...');
            duplicateIds.forEach(([duplicateId, count]) => {
                const cats = allCategoryData.filter(c => c.categoryId === duplicateId);
                // 保留第一个，修复其他的
                for (let i = 1; i < cats.length; i++) {
                    let newId = duplicateId;
                    let attemptCount = 0;
                    while (usedCategoryIds.has(newId)) {
                        attemptCount++;
                        newId = `${duplicateId}-fix${attemptCount}`;
                    }
                    console.log(`   修复: ${cats[i].path} 从 ${duplicateId} 改为 ${newId}`);
                    cats[i].categoryId = newId;
                    usedCategoryIds.add(newId);
                    // 更新 categoryIdMap
                    categoryIdMap.set(cats[i].path, newId);
                    
                    // 如果这个分类是子分类，需要更新 subCategoriesMap 中的引用
                    subCategoriesMap.forEach((subCats, parentId) => {
                        const subIndex = subCats.findIndex(sub => sub.path === cats[i].path);
                        if (subIndex !== -1) {
                            subCats[subIndex].categoryId = newId;
                        }
                    });
                }
            });
            console.log('✅ 重复的 category-id 修复完成');
        }

        // 创建分类：主分类和其子分类一起创建
        mainCategories.forEach(catData => {
            // 如果该主分类有子分类，需要过滤出主分类的直接文件
            const subCategories = subCategoriesMap.get(catData.categoryId);
            if (subCategories && subCategories.length > 0) {
                // 获取所有子分类的路径
                const subCategoryPaths = new Set(subCategories.map(sub => sub.path));
                
                // 过滤出主分类的直接文件（文件路径深度与主分类相同，且不在子分类路径下）
                const directFiles = catData.files.filter(file => {
                    if (!file.path) return false;
                    // 检查文件路径是否属于任何子分类
                    for (const subPath of subCategoryPaths) {
                        if (file.path.startsWith(subPath + '/')) {
                            return false; // 属于子分类
                        }
                    }
                    // 检查文件路径深度是否与主分类相同
                    const filePathDepth = getPathDepth(file.path);
                    const categoryPathDepth = getPathDepth(catData.path);
                    return filePathDepth === categoryPathDepth + 1; // 文件应该在主分类的直接子目录中
                });
                
                // 更新主分类的文件列表，只保留直接文件
                catData.files = directFiles;
                catData.fileCount = directFiles.length;
            }
            
            // 创建主分类
            const categoryHtml = createCategoryHtml(catData, false);
            categoriesContainer.appendChild(categoryHtml);
            
            // 如果该主分类有子分类，立即创建子分类（紧跟在父分类后面）
            if (subCategories && subCategories.length > 0) {
                // 验证子分类的父路径是否正确
                const validSubCategories = subCategories.filter(subCatData => {
                    // 验证子分类的父路径是否匹配当前主分类的路径
                    if (subCatData.parentPath !== catData.path) {
                        console.warn(`子分类 ${subCatData.path} 的父路径不匹配:`);
                        console.warn(`  子分类的父路径: ${subCatData.parentPath}`);
                        console.warn(`  当前主分类路径: ${catData.path}`);
                        return false;
                    }
                    return true;
                });
                
                validSubCategories.forEach(subCatData => {
                    // 确保子分类的 parentCategoryId 正确指向父分类
                    subCatData.parentCategoryId = catData.categoryId;
                    const subCategoryHtml = createCategoryHtml(subCatData, true);
                    categoriesContainer.appendChild(subCategoryHtml);
                });
            }
        });
        
        // 处理没有父分类的子分类（理论上不应该有，但为了安全）
        subCategoriesMap.forEach((subCategories, parentId) => {
            // 检查父分类是否存在
            const parentExists = mainCategories.some(cat => cat.categoryId === parentId);
            if (!parentExists) {
                console.warn(`子分类的父分类不存在: ${parentId}，这些子分类将被忽略`);
                // 不创建这些子分类，因为它们没有父分类
            }
        });

        // 更新 allCategories 引用（因为 DOM 已改变）
        const newAllCategories = document.querySelectorAll('.category');
        // 注意：这里不能直接修改 allCategories，因为它是 const
        // 但后续代码会通过 document.querySelectorAll 重新获取，所以这里不需要修改

        const totalSubCategories = Array.from(subCategoriesMap.values()).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`已创建 ${mainCategories.length} 个主分类和 ${totalSubCategories} 个子分类`);
        
        // 验证：检查 JSON 中的所有分类是否都正确显示
        validateCategories(data, mainCategories, subCategoriesMap);
    }

    /**
     * 验证分类是否正确显示
     * @param {Object} jsonData - user_models.json 的原始数据
     * @param {Array} mainCategories - 主分类数组
     * @param {Map} subCategoriesMap - 子分类映射
     */
    function validateCategories(jsonData, mainCategories, subCategoriesMap) {
        if (!jsonData || !jsonData.categories) {
            console.error('验证失败：JSON 数据无效');
            return;
        }

        const jsonCategoryKeys = Object.keys(jsonData.categories);
        const jsonMainCategories = [];
        const jsonSubCategories = [];
        
        // 分析 JSON 中的分类结构
        jsonCategoryKeys.forEach(key => {
            const category = jsonData.categories[key];
            if (!category || !category.mkdir) return;
            
            const path = category.mkdir.replace('mkdir -p ', '').trim();
            const pathParts = path.split('/').filter(p => p);
            
            // 判断是一级还是二级分类
            if (key.includes('/')) {
                // 二级分类（key 中包含斜杠）
                jsonSubCategories.push({
                    key: key,
                    path: path,
                    parentKey: key.split('/')[0]
                });
            } else {
                // 一级分类
                jsonMainCategories.push({
                    key: key,
                    path: path
                });
            }
        });

        console.log('\n========== 分类验证报告 ==========');
        console.log(`JSON 中的一级分类数量: ${jsonMainCategories.length}`);
        console.log(`JSON 中的二级分类数量: ${jsonSubCategories.length}`);
        console.log(`HTML 中显示的主分类数量: ${mainCategories.length}`);
        
        const htmlSubCategoriesCount = Array.from(subCategoriesMap.values()).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`HTML 中显示的子分类数量: ${htmlSubCategoriesCount}`);
        console.log('');

        // 验证一级分类
        console.log('--- 一级分类验证 ---');
        const htmlMainPaths = new Set(mainCategories.map(cat => cat.path));
        const jsonMainPaths = new Set(jsonMainCategories.map(cat => cat.path));
        const missingMainCategories = [];
        const extraMainCategories = [];
        
        // 检查 JSON 中的一级分类是否都在 HTML 中
        jsonMainCategories.forEach(jsonMain => {
            if (!htmlMainPaths.has(jsonMain.path)) {
                missingMainCategories.push(jsonMain);
            }
        });
        
        // 检查 HTML 中是否有 JSON 中没有的一级分类（可能是自动创建的父分类）
        htmlMainPaths.forEach(path => {
            if (!jsonMainPaths.has(path)) {
                const cat = mainCategories.find(c => c.path === path);
                if (cat) {
                    // 检查是否是自动创建的父分类（fileCount 为 0）
                    const isAutoCreated = cat.fileCount === 0;
                    extraMainCategories.push({
                        path: path,
                        isAutoCreated: isAutoCreated,
                        categoryId: cat.categoryId
                    });
                }
            }
        });
        
        if (missingMainCategories.length > 0) {
            console.warn(`❌ 缺失的一级分类 (${missingMainCategories.length}):`);
            missingMainCategories.forEach(cat => {
                console.warn(`   - ${cat.key}: ${cat.path}`);
            });
        } else {
            console.log('✅ 所有一级分类都已正确显示');
        }
        
        if (extraMainCategories.length > 0) {
            const autoCreated = extraMainCategories.filter(cat => cat.isAutoCreated);
            const manual = extraMainCategories.filter(cat => !cat.isAutoCreated);
            
            if (autoCreated.length > 0) {
                console.log(`ℹ️  自动创建的父分类 (${autoCreated.length}):`);
                autoCreated.forEach(cat => {
                    console.log(`   - ${cat.path} (${cat.categoryId})`);
                });
            }
            
            if (manual.length > 0) {
                console.warn(`⚠️  额外的一级分类 (${manual.length}，不在 JSON 中):`);
                manual.forEach(cat => {
                    console.warn(`   - ${cat.path}`);
                });
            }
        }

        // 验证二级分类
        console.log('\n--- 二级分类验证 ---');
        const htmlSubPaths = new Set();
        subCategoriesMap.forEach((subCats, parentId) => {
            subCats.forEach(subCat => {
                htmlSubPaths.add(subCat.path);
            });
        });
        
        const missingSubCategories = [];
        jsonSubCategories.forEach(jsonSub => {
            if (!htmlSubPaths.has(jsonSub.path)) {
                missingSubCategories.push(jsonSub);
            }
        });
        
        if (missingSubCategories.length > 0) {
            console.warn(`❌ 缺失的二级分类 (${missingSubCategories.length}):`);
            missingSubCategories.forEach(cat => {
                console.warn(`   - ${cat.key}: ${cat.path}`);
            });
        } else {
            console.log('✅ 所有二级分类都已正确显示');
        }

        // 验证父子关系
        console.log('\n--- 父子关系验证 ---');
        const parentChildIssues = [];
        jsonSubCategories.forEach(jsonSub => {
            const htmlSub = Array.from(subCategoriesMap.values())
                .flat()
                .find(sub => sub.path === jsonSub.path);
            
            if (htmlSub) {
                // 从子分类路径推导期望的父路径
                // 例如：/root/ComfyUI/models/loras/Flux -> /root/ComfyUI/models/loras
                const pathParts = jsonSub.path.split('/').filter(p => p);
                const expectedParentPath = '/' + pathParts.slice(0, -1).join('/');
                
                if (htmlSub.parentPath !== expectedParentPath) {
                    parentChildIssues.push({
                        sub: jsonSub,
                        expectedParent: expectedParentPath,
                        actualParent: htmlSub.parentPath || '未设置',
                        parentCategoryId: htmlSub.parentCategoryId || '未设置'
                    });
                }
            } else {
                // 子分类在 HTML 中不存在（已在 missingSubCategories 中处理）
            }
        });
        
        if (parentChildIssues.length > 0) {
            console.warn(`❌ 父子关系错误 (${parentChildIssues.length}):`);
            parentChildIssues.forEach(issue => {
                console.warn(`   - ${issue.sub.key}: ${issue.sub.path}`);
                console.warn(`     期望父分类路径: ${issue.expectedParent}`);
                console.warn(`     实际父分类路径: ${issue.actualParent}`);
                if (issue.parentCategoryId) {
                    console.warn(`     实际父分类ID: ${issue.parentCategoryId}`);
                }
            });
        } else {
            console.log('✅ 所有父子关系都正确');
        }
        
        // 详细列出所有父子关系
        console.log('\n--- 父子关系详情 ---');
        subCategoriesMap.forEach((subCats, parentId) => {
            const parentCat = mainCategories.find(cat => cat.categoryId === parentId);
            if (parentCat) {
                console.log(`父分类: ${parentCat.path} (${parentId})`);
                subCats.forEach(subCat => {
                    console.log(`  └─ 子分类: ${subCat.path}`);
                });
            }
        });

        // 统计信息
        console.log('\n--- 统计信息 ---');
        console.log(`一级分类匹配: ${jsonMainCategories.length - missingMainCategories.length}/${jsonMainCategories.length}`);
        console.log(`二级分类匹配: ${jsonSubCategories.length - missingSubCategories.length}/${jsonSubCategories.length}`);
        console.log(`父子关系正确: ${jsonSubCategories.length - parentChildIssues.length}/${jsonSubCategories.length}`);
        
        if (missingMainCategories.length === 0 && missingSubCategories.length === 0 && parentChildIssues.length === 0) {
            console.log('\n✅✅✅ 所有分类验证通过！✅✅✅');
        } else {
            console.log('\n⚠️  存在验证问题，请检查上述警告');
        }
        console.log('=====================================\n');
    }

    /**
     * 创建分类 HTML 元素
     * @param {Object} catData - 分类数据
     * @param {boolean} isSubcategory - 是否是子分类
     * @returns {HTMLElement} - 分类元素
     */
    function createCategoryHtml(catData, isSubcategory) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';
        if (isSubcategory) {
            categoryDiv.classList.add('subcategory');
        }
        categoryDiv.id = `nav-${catData.categoryId}`;
        categoryDiv.setAttribute('data-category-id', catData.categoryId);
        categoryDiv.setAttribute('data-group-key', catData.groupKey);
        categoryDiv.setAttribute('data-group-name', catData.groupName);
        if (catData.parentCategoryId) {
            categoryDiv.setAttribute('data-parent-category', catData.parentCategoryId);
        }

        const mkdirCount = 1; // 每个分类都有一个 mkdir 命令
        const lnCount = catData.fileCount;

        categoryDiv.innerHTML = `
            <div class="category-header">
                <div class="category-header-left">
                    <div class="category-title">${catData.path}</div>
                    <div class="category-info">${mkdirCount} 个目录创建命令, ${lnCount} 个软链接</div>
                </div>
                <div class="category-actions">
                    <button class="btn btn-copy" data-copy-target="${catData.categoryId}">复制</button>
                </div>
            </div>
            <div class="category-body">
                <div class="commands-list" id="${catData.categoryId}"></div>
            </div>
        `;

        return categoryDiv;
    }

    /**
     * 将 user_models.json 的数据格式转换为页面需要的格式
     * @param {Object} data - user_models.json 的数据
     * @returns {Object} - 转换后的数据格式 { "category-id": ["command1", "command2", ...] }
     */
    function convertUserModels2Data(data) {
        if (!data || !data.categories) {
            return {};
        }

        const result = {};
        
        // 创建路径到 category-id 的映射（基于动态创建的分类）
        const pathToCategoryIdMap = createPathToCategoryIdMap();

        // 遍历所有分类
        Object.keys(data.categories).forEach(categoryKey => {
            const category = data.categories[categoryKey];
            if (!category || !category.mkdir || !category.files) {
                return;
            }

            // 从 mkdir 命令中提取路径
            const mkdirPath = category.mkdir.replace('mkdir -p ', '').trim();
            
            // 查找匹配的 category-id
            const categoryId = findMatchingCategoryId(mkdirPath, pathToCategoryIdMap);
            
            if (!categoryId) {
                console.warn(`未找到匹配的分类ID，路径: ${mkdirPath}`);
                return;
            }

            // 构建命令数组
            const commands = [];
            
            // 添加 mkdir 命令
            commands.push(category.mkdir);
            
            // 添加所有 ln -s 命令
            category.files.forEach(file => {
                if (file.command) {
                    commands.push(file.command);
                }
            });

            // 如果该分类已存在，合并命令（避免重复 mkdir）
            if (result[categoryId]) {
                // 合并时，如果已有 mkdir，则只添加 ln -s 命令
                const existingCommands = result[categoryId];
                const hasMkdir = existingCommands.some(cmd => cmd.startsWith('mkdir -p'));
                
                if (hasMkdir) {
                    // 只添加新的 ln -s 命令
                    category.files.forEach(file => {
                        if (file.command && !existingCommands.includes(file.command)) {
                            existingCommands.push(file.command);
                        }
                    });
                } else {
                    // 添加所有命令
                    result[categoryId] = [...existingCommands, ...commands.slice(1)];
                }
            } else {
                result[categoryId] = commands;
            }
        });

        return result;
    }

    /**
     * 创建路径到 category-id 的映射
     * @returns {Map<string, string>} - 路径到 category-id 的映射
     */
    function createPathToCategoryIdMap() {
        const map = new Map();
        const currentCategories = document.querySelectorAll('.category');
        
        // 遍历所有分类，建立路径映射
        currentCategories.forEach(category => {
            const categoryId = category.getAttribute('data-category-id');
            const titleEl = category.querySelector('.category-title');
            
            if (categoryId && titleEl) {
                const fullPath = titleEl.textContent.trim();
                map.set(fullPath, categoryId);
                
                // 也添加不带 /root 前缀的路径作为备用
                if (fullPath.startsWith('/root/')) {
                    const shortPath = fullPath.replace('/root/', '');
                    if (!map.has(shortPath)) {
                        map.set(shortPath, categoryId);
                    }
                }
            }
        });
        
        return map;
    }

    /**
     * 根据路径查找匹配的 category-id
     * @param {string} path - 要匹配的路径
     * @param {Map<string, string>} pathMap - 路径映射表
     * @returns {string|null} - 匹配的 category-id，如果未找到则返回 null
     */
    function findMatchingCategoryId(path, pathMap) {
        // 精确匹配
        if (pathMap.has(path)) {
            return pathMap.get(path);
        }

        // 处理其他子目录情况：从完整路径开始，逐步向上查找父路径
        let currentPath = path;
        const pathSegments = [];
        
        // 收集所有可能的父路径
        while (currentPath.includes('/') && currentPath !== '/') {
            pathSegments.push(currentPath);
            currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        }
        
        // 按从长到短的顺序查找匹配
        for (const testPath of pathSegments) {
            if (pathMap.has(testPath)) {
                return pathMap.get(testPath);
            }
        }

        // 模糊匹配：查找最相似的路径
        let bestMatch = null;
        let bestMatchLength = 0;
        
        for (const [mapPath, categoryId] of pathMap.entries()) {
            // 如果路径完全包含在映射路径中，或者映射路径完全包含在路径中
            if (path.startsWith(mapPath + '/') || mapPath.startsWith(path + '/')) {
                const matchLength = Math.min(path.length, mapPath.length);
                if (matchLength > bestMatchLength) {
                    bestMatch = categoryId;
                    bestMatchLength = matchLength;
                }
            }
        }

        return bestMatch;
    }


    /**
     * 应用所有模型数据到页面（包括原始数据和用户添加的数据）
     * @param {Record<string,string[]>} allModelsData
     */
    function applyAllModelsData(allModelsData) {
        if (!allModelsData || typeof allModelsData !== 'object') return;

        // 现在所有 category ID 都基于路径，不需要特殊处理
        Object.keys(allModelsData).forEach(categoryId => {
            const commands = allModelsData[categoryId] || [];
            const commandsList = document.getElementById(categoryId);
            if (!commandsList) return;

            // 先清空该分类的所有内容（包括原始HTML中的）
            commandsList.innerHTML = '';

            // 重新添加所有命令
            commands.forEach((command, index) => {
                if (index > 0) {
                    const br = document.createTextNode('\n');
                    commandsList.appendChild(br);
                }

                // 创建包装容器
                const wrapper = document.createElement('span');
                wrapper.className = 'command-line-wrapper';

                // 创建命令行元素
                const span = document.createElement('span');
                span.className = 'command-line';
                span.title = '点击复制单行';
                span.textContent = command;
                span.dataset.userAdded = 'true';

                // 组装结构
                wrapper.appendChild(span);

                // 添加到列表
                commandsList.appendChild(wrapper);
            });

            // 更新统计信息
            updateCategoryStats(categoryId);
            
            // 应用斑马纹效果
            applyZebraStriping(commandsList);
        });

        // 更新导航栏中的模型数量
        updateNavItemCounts();
    }

    /**
     * 更新分类的统计信息
     * @param {string} categoryId - 分类ID
     */
    function updateCategoryStats(categoryId) {
        const commandsList = document.getElementById(categoryId);
        if (!commandsList) return;

        const categoryElement = commandsList.closest('.category');
        if (!categoryElement) return;

        const mkdirCount = commandsList.querySelectorAll('.command-line').length;
        const lnCount = Array.from(commandsList.querySelectorAll('.command-line'))
            .filter(cmd => cmd.textContent.trim().startsWith('ln -s')).length;
        const mkdirCount2 = mkdirCount - lnCount;

        const infoElement = categoryElement.querySelector('.category-info');
        if (infoElement) {
            infoElement.textContent = `${mkdirCount2} 个目录创建命令, ${lnCount} 个软链接`;
        }
    }

    /**
     * 更新导航栏中的模型数量
     */
    function updateNavItemCounts() {
        document.querySelectorAll('.sidebar-nav-item').forEach(navItem => {
            const categoryId = navItem.dataset.categoryId;
            if (!categoryId) return;

            const categoryElement = document.getElementById(categoryId);
            if (!categoryElement) return;

            const commandsList = categoryElement.querySelector('.commands-list');
            if (!commandsList) return;

            const modelCount = commandsList.querySelectorAll('.command-line').length;
            const countElement = navItem.querySelector('.sidebar-nav-item-count');
            if (countElement) {
                countElement.textContent = modelCount;
            }
        });
    }


    // -------------------------------------------------------------------------
    // 启动！
    // -------------------------------------------------------------------------
    initializePage();
});