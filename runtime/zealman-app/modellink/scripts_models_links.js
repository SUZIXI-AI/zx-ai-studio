/**
 * ComfyUI 模型下载命令页面脚本
 *
 * 主要功能:
 * 1. 从 scripts_models_links.json 加载模型数据
 * 2. 动态生成分类导航栏
 * 3. 为每个模型生成 cg down 下载命令
 * 4. 统一的复制逻辑（分类、全部），尊重搜索过滤器
 * 5. 点击单行命令即可复制
 * 6. 实时搜索功能
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

    // -------------------------------------------------------------------------
    // 初始化函数
    // -------------------------------------------------------------------------

    /**
     * 页面加载时的主初始化函数
     */
    function initializePage() {
        // 从 scripts_models_links.json 加载数据
        loadModelsFromFile().then(() => {
            // 初始化导航
            initCategoryNavigation();
            
            addEventListeners();
            
            // 默认显示介绍页面
            showIntroPage();
        }).catch((err) => {
            console.error('加载 scripts_models_links.json 失败:', err);
            showAppMessage('无法加载模型数据，请确保 scripts_models_links.json 文件存在。');
        });
    }

    /**
     * 动态生成快速跳转导航栏
     */
    function initCategoryNavigation() {
        if (!categoryNavList) return;

        const categories = document.querySelectorAll('.category');
        if (categories.length === 0) return;

        // 清空导航列表
        categoryNavList.innerHTML = '';

        // 添加"使用说明"入口
        const introNavItem = document.createElement('div');
        introNavItem.className = 'sidebar-nav-item';
        introNavItem.id = 'introNavItem';
        introNavItem.innerHTML = `
            <span>📖 使用说明</span>
        `;
        introNavItem.title = '查看下载命令使用说明';
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

        // 分离主分类和子分类
        const mainCategories = [];
        const subcategories = new Map(); // key: parentCategoryId, value: array of subcategories

        categories.forEach(category => {
            const isSubcategory = category.classList.contains('subcategory');
            const parentCategoryId = category.getAttribute('data-parent-category');
            
            if (isSubcategory && parentCategoryId) {
                if (!subcategories.has(parentCategoryId)) {
                    subcategories.set(parentCategoryId, []);
                }
                subcategories.get(parentCategoryId).push(category);
            } else {
                mainCategories.push(category);
            }
        });

        // 按分类名称排序主分类
        const sortedMainCategories = Array.from(mainCategories).sort((a, b) => {
            const titleA = a.querySelector('.category-title').textContent.toLowerCase();
            const titleB = b.querySelector('.category-title').textContent.toLowerCase();
            return titleA.localeCompare(titleB, 'zh-CN');
        });

        // 创建导航项
        sortedMainCategories.forEach(category => {
            const categoryId = category.id;
            const categoryDomId = category.getAttribute('data-category-id');
            const titleEl = category.querySelector('.category-title');
            
            if (!categoryId || !categoryDomId || !titleEl) {
                return;
            }

            const displayName = titleEl.textContent;
            
            // 获取模型数量
            const commandsList = category.querySelector('.commands-list');
            let modelCount = 0;
            if (commandsList) {
                modelCount = commandsList.querySelectorAll('.command-line').length;
            }

            // 创建主分类导航项
            const navItem = document.createElement('div');
            navItem.className = 'sidebar-nav-item';
            navItem.dataset.categoryId = categoryDomId;
            navItem.innerHTML = `
                <span>${displayName}</span>
                <span class="sidebar-nav-item-count">${modelCount}</span>
            `;
            navItem.title = displayName;
            categoryNavList.appendChild(navItem);

            // 如果有子分类，创建子分类容器
            // 注意：subcategories Map 的 key 是 data-parent-category 的值，也就是主分类的 data-category-id
            const subcategoryList = subcategories.get(categoryDomId);
            if (subcategoryList && subcategoryList.length > 0) {
                // 按名称排序子分类
                const sortedSubcategories = Array.from(subcategoryList).sort((a, b) => {
                    const titleA = a.querySelector('.category-title').textContent.toLowerCase();
                    const titleB = b.querySelector('.category-title').textContent.toLowerCase();
                    return titleA.localeCompare(titleB, 'zh-CN');
                });

                const subcategoryContainer = document.createElement('div');
                subcategoryContainer.className = 'sidebar-nav-subcategories';
                subcategoryContainer.style.display = 'none'; // 默认隐藏
                subcategoryContainer.dataset.parentNavId = categoryId.replace('nav-', '');

                sortedSubcategories.forEach(subCategory => {
                    const subCategoryId = subCategory.id;
                    const subCategoryDomId = subCategory.getAttribute('data-category-id');
                    const subTitleEl = subCategory.querySelector('.category-title');
                    
                    if (!subCategoryId || !subCategoryDomId || !subTitleEl) {
                        return;
                    }

                    // 提取子分类显示名称（去掉父分类名称部分）
                    let subDisplayName = subTitleEl.textContent;
                    if (subDisplayName.includes(' / ')) {
                        subDisplayName = subDisplayName.split(' / ').pop();
                    }

                    // 获取子分类模型数量
                    const subCommandsList = subCategory.querySelector('.commands-list');
                    let subModelCount = 0;
                    if (subCommandsList) {
                        subModelCount = subCommandsList.querySelectorAll('.command-line').length;
                    }

                    const subNavItem = document.createElement('div');
                    subNavItem.className = 'sidebar-nav-item sidebar-nav-subitem';
                    subNavItem.dataset.categoryId = subCategoryDomId;
                    subNavItem.innerHTML = `
                        <span>${subDisplayName}</span>
                        <span class="sidebar-nav-item-count">${subModelCount}</span>
                    `;
                    subNavItem.title = subTitleEl.textContent;
                    subcategoryContainer.appendChild(subNavItem);
                });

                categoryNavList.appendChild(subcategoryContainer);
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
            
            if (!isSubItem) {
                // 主分类：检查是否有子分类容器
                const subcategoryContainer = target.nextElementSibling;
                if (subcategoryContainer && subcategoryContainer.classList.contains('sidebar-nav-subcategories')) {
                    const isExpanded = subcategoryContainer.style.display !== 'none';
                    if (isExpanded) {
                        subcategoryContainer.style.display = 'none';
                        target.classList.remove('expanded');
                    } else {
                        subcategoryContainer.style.display = 'block';
                        target.classList.add('expanded');
                    }
                    // 不阻止事件，继续显示主分类内容
                }
            }

            // 显示分类内容
            const navId = `nav-${categoryId}`;
            toggleCategoryVisibility(navId, target);
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
        const categories = document.querySelectorAll('.category');

        categories.forEach(category => {
            // 搜索词为空，恢复默认状态（显示介绍页面或选中的分类）
            if (searchTerm === '') {
                // 检查是否有选中的按钮
                const activeButton = document.querySelector('.sidebar-nav-item.active');
                if (activeButton) {
                    const activeCategoryId = activeButton.dataset.categoryId;
                    const categoryId = category.id.replace('nav-', '');
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

    /**
     * 切换分类的显示/隐藏状态
     * @param {string} categoryId - .category 元素的 ID (e.g., "nav-category-1")
     * @param {HTMLElement} button - 被点击的导航按钮
     */
    function toggleCategoryVisibility(categoryId, button) {
        const categoryElement = document.getElementById(categoryId);
        if (!categoryElement) {
            console.error(`未找到 ID 为 ${categoryId} 的元素`);
            return;
        }

        // 隐藏介绍页面
        if (introPage) {
            introPage.classList.add('hidden');
        }

        // 隐藏所有分类
        const categories = document.querySelectorAll('.category');
        categories.forEach(cat => {
            cat.classList.add('hidden');
        });

        // 移除所有按钮的选中状态（包括使用说明按钮）
        document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
            btn.classList.remove('active');
        });

        // 显示选中的分类
        categoryElement.classList.remove('hidden');
        if (button) {
            button.classList.add('active');
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
        
        // 先移除所有斑马纹类
        const allLines = commandsList.querySelectorAll('.command-line');
        allLines.forEach(line => {
            line.classList.remove('zebra-odd', 'zebra-even');
        });
        
        // 只对可见的元素重新计算斑马纹
        const visibleLines = Array.from(commandsList.querySelectorAll('.command-line')).filter(line => {
            return !line.classList.contains('hidden');
        });
        
        visibleLines.forEach((line, index) => {
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
            contentTitle.textContent = 'ComfyUI 模型下载命令使用';
            contentSubtitle.textContent = '了解如何使用 cg down 命令下载模型文件';
        }
        // 隐藏所有分类
        const categories = document.querySelectorAll('.category');
        categories.forEach(cat => {
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

    // -------------------------------------------------------------------------
    // 复制功能
    // -------------------------------------------------------------------------

    /**
     * 从指定分类中获取所有可见命令
     * @param {string} categoryId - .commands-list 元素的 ID
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
     * @param {string} categoryId - .commands-list 元素的 ID
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
    // 数据加载功能
    // -------------------------------------------------------------------------

    /**
     * 从 scripts_models_links.json 加载所有模型数据
     */
    async function loadModelsFromFile() {
        try {
            const resp = await fetch('scripts_models_links.json', { cache: 'no-cache' });
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            const data = await resp.json();
            
            // 根据 JSON 数据动态创建分类结构
            createCategoriesFromJson(data);
            
            return Promise.resolve();
        } catch (err) {
            console.error('无法加载 scripts_models_links.json:', err);
            return Promise.reject(err);
        }
    }

    /**
     * 根据 JSON 数据动态创建分类 HTML 结构
     * @param {Object} data - scripts_models_links.json 的数据
     */
    function createCategoriesFromJson(data) {
        if (!data || typeof data !== 'object') {
            console.error('无效的 JSON 数据');
            return;
        }

        const categoriesContainer = document.getElementById('categoriesContainer');
        if (!categoriesContainer) {
            console.error('找不到 categoriesContainer 元素');
            return;
        }

        // 清空现有分类
        categoriesContainer.innerHTML = '';

        let globalIndex = 0;
        
        // 第一步：收集所有分类，分离主分类和子分类（基于路径字符串格式）
        const mainCategoriesMap = new Map(); // key: categoryName, value: { name, models: [] }
        const subcategoriesMap = new Map(); // key: parentCategoryName, value: Map<subCategoryName, models[]>
        
        // 先处理路径字符串格式的子分类（如 "checkpoints/SDXL"）
        Object.keys(data).forEach((categoryKey) => {
            const categoryData = data[categoryKey];
            
            // 检查是否是路径字符串格式的子分类（如 "checkpoints/SDXL"）
            if (categoryKey.includes('/')) {
                const pathParts = categoryKey.split('/');
                const parentCategoryName = pathParts[0];
                const subCategoryName = pathParts.slice(1).join('/');
                
                if (Array.isArray(categoryData) && categoryData.length > 0) {
                    if (!subcategoriesMap.has(parentCategoryName)) {
                        subcategoriesMap.set(parentCategoryName, new Map());
                    }
                    subcategoriesMap.get(parentCategoryName).set(subCategoryName, categoryData);
                }
                return; // 跳过，稍后处理
            }
            
            // 检查是否是嵌套对象格式（如 "checkpoints": { "Flux": [...], "SDXL": [...] }）
            if (categoryData && typeof categoryData === 'object' && !Array.isArray(categoryData)) {
                // 这是嵌套对象格式，需要转换为路径字符串格式的处理方式
                Object.keys(categoryData).forEach((subCategoryName) => {
                    const subModels = categoryData[subCategoryName];
                    if (Array.isArray(subModels) && subModels.length > 0) {
                        if (!subcategoriesMap.has(categoryKey)) {
                            subcategoriesMap.set(categoryKey, new Map());
                        }
                        subcategoriesMap.get(categoryKey).set(subCategoryName, subModels);
                    }
                });
                return; // 跳过，稍后处理
            }
            
            // 普通数组格式（没有子分类）
            if (Array.isArray(categoryData) && categoryData.length > 0) {
                mainCategoriesMap.set(categoryKey, {
                    name: categoryKey,
                    models: categoryData
                });
            }
        });

        // 第二步：创建分类 HTML（先创建主分类，再创建子分类）
        // 创建主分类（包括有子分类的主分类）
        const allCategoryNames = new Set([...mainCategoriesMap.keys(), ...subcategoriesMap.keys()]);
        const sortedCategoryNames = Array.from(allCategoryNames).sort((a, b) => {
            return a.toLowerCase().localeCompare(b.toLowerCase(), 'zh-CN');
        });

        sortedCategoryNames.forEach((categoryName) => {
            const hasSubcategories = subcategoriesMap.has(categoryName);
            const mainCategoryData = mainCategoriesMap.get(categoryName);
            
            // 调试：检查关键分类
            if (categoryName === 'loras' || categoryName === 'diffusion_models') {
                console.log(`[调试] 处理分类 ${categoryName}:`, {
                    hasSubcategories,
                    hasMainCategoryData: !!mainCategoryData,
                    subcategoryCount: hasSubcategories ? subcategoriesMap.get(categoryName).size : 0
                });
            }
            
            // 如果有子分类，创建父分类
            if (hasSubcategories) {
                if (categoryName === 'loras' || categoryName === 'diffusion_models') {
                    console.log(`[调试] 创建父分类 ${categoryName}, 子分类数:`, subcategoriesMap.get(categoryName).size);
                }
                const parentCategoryId = `category-${globalIndex++}`;
                const parentNavId = `nav-${parentCategoryId}`;
                
                // 计算所有子分类的总命令数
                let totalCommands = 0;
                const subcategories = subcategoriesMap.get(categoryName);
                subcategories.forEach((models) => {
                    totalCommands += models.length;
                });
                
                // 如果有主分类数据，也加上
                if (mainCategoryData) {
                    totalCommands += mainCategoryData.models.length;
                }

                // 创建父分类 HTML
                const parentCategoryDiv = document.createElement('div');
                parentCategoryDiv.className = 'category';
                parentCategoryDiv.id = parentNavId;
                parentCategoryDiv.setAttribute('data-category-id', parentCategoryId);

                parentCategoryDiv.innerHTML = `
                    <div class="category-header">
                        <div class="category-header-left">
                            <div class="category-title">${categoryName}</div>
                            <div class="category-info">${totalCommands} 个下载命令</div>
                        </div>
                        <div class="category-actions">
                            <button class="btn btn-copy" data-copy-target="${parentCategoryId}">复制</button>
                        </div>
                    </div>
                    <div class="category-body">
                        <div class="commands-list" id="${parentCategoryId}"></div>
                    </div>
                `;

                const parentCommandsList = parentCategoryDiv.querySelector(`#${parentCategoryId}`);

                // 先添加主分类的命令（如果有）
                if (mainCategoryData) {
                    mainCategoryData.models.forEach((modelPath) => {
                        const command = `cg down ${modelPath}`;
                        const wrapper = document.createElement('span');
                        wrapper.className = 'command-line-wrapper';
                        const span = document.createElement('span');
                        span.className = 'command-line';
                        span.title = '点击复制单行';
                        span.textContent = command;
                        wrapper.appendChild(span);
                        parentCommandsList.appendChild(wrapper);
                    });
                }

                // 遍历子分类
                const sortedSubcategories = Array.from(subcategories.entries()).sort((a, b) => {
                    return a[0].toLowerCase().localeCompare(b[0].toLowerCase(), 'zh-CN');
                });

                sortedSubcategories.forEach(([subCategoryName, subModels]) => {
                    // 创建子分类 ID
                    const subCategoryId = `category-${globalIndex++}`;
                    const subNavId = `nav-${subCategoryId}`;

                    // 创建子分类 HTML
                    const subCategoryDiv = document.createElement('div');
                    subCategoryDiv.className = 'category subcategory';
                    subCategoryDiv.id = subNavId;
                    subCategoryDiv.setAttribute('data-category-id', subCategoryId);
                    subCategoryDiv.setAttribute('data-parent-category', parentCategoryId);

                    // 创建下载命令列表
                    const commands = subModels.map(modelPath => {
                        return `cg down ${modelPath}`;
                    });

                    subCategoryDiv.innerHTML = `
                        <div class="category-header">
                            <div class="category-header-left">
                                <div class="category-title">${categoryName} / ${subCategoryName}</div>
                                <div class="category-info">${commands.length} 个下载命令</div>
                            </div>
                            <div class="category-actions">
                                <button class="btn btn-copy" data-copy-target="${subCategoryId}">复制</button>
                            </div>
                        </div>
                        <div class="category-body">
                            <div class="commands-list" id="${subCategoryId}"></div>
                        </div>
                    `;

                    // 添加命令到子分类的命令列表
                    const subCommandsList = subCategoryDiv.querySelector(`#${subCategoryId}`);
                    commands.forEach((command) => {
                        const wrapper = document.createElement('span');
                        wrapper.className = 'command-line-wrapper';
                        const span = document.createElement('span');
                        span.className = 'command-line';
                        span.title = '点击复制单行';
                        span.textContent = command;
                        wrapper.appendChild(span);
                        subCommandsList.appendChild(wrapper);
                        
                        // 同时添加到父分类的命令列表
                        const parentWrapper = document.createElement('span');
                        parentWrapper.className = 'command-line-wrapper';
                        const parentSpan = document.createElement('span');
                        parentSpan.className = 'command-line';
                        parentSpan.title = '点击复制单行';
                        parentSpan.textContent = command;
                        parentWrapper.appendChild(parentSpan);
                        parentCommandsList.appendChild(parentWrapper);
                    });

                    // 应用斑马纹效果
                    applyZebraStriping(subCommandsList);

                    // 添加到容器（在父分类之前添加，这样父分类会在最后）
                    categoriesContainer.appendChild(subCategoryDiv);
                });

                // 应用斑马纹效果到父分类
                applyZebraStriping(parentCommandsList);

                // 添加到容器（父分类在最后，这样在DOM中父分类会在子分类之后）
                categoriesContainer.appendChild(parentCategoryDiv);
            } else if (mainCategoryData) {
                // 没有子分类的普通分类
                const categoryId = `category-${globalIndex++}`;
                const navId = `nav-${categoryId}`;

                // 创建分类 HTML
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category';
                categoryDiv.id = navId;
                categoryDiv.setAttribute('data-category-id', categoryId);

                // 创建下载命令列表
                const commands = mainCategoryData.models.map(modelPath => {
                    return `cg down ${modelPath}`;
                });

                const commandCount = commands.length;

                categoryDiv.innerHTML = `
                    <div class="category-header">
                        <div class="category-header-left">
                            <div class="category-title">${categoryName}</div>
                            <div class="category-info">${commandCount} 个下载命令</div>
                        </div>
                        <div class="category-actions">
                            <button class="btn btn-copy" data-copy-target="${categoryId}">复制</button>
                        </div>
                    </div>
                    <div class="category-body">
                        <div class="commands-list" id="${categoryId}"></div>
                    </div>
                `;

                // 添加命令到命令列表
                const commandsList = categoryDiv.querySelector(`#${categoryId}`);
                commands.forEach((command) => {
                    const wrapper = document.createElement('span');
                    wrapper.className = 'command-line-wrapper';
                    const span = document.createElement('span');
                    span.className = 'command-line';
                    span.title = '点击复制单行';
                    span.textContent = command;
                    wrapper.appendChild(span);
                    commandsList.appendChild(wrapper);
                });

                // 应用斑马纹效果
                applyZebraStriping(commandsList);

                // 添加到容器
                categoriesContainer.appendChild(categoryDiv);
            }
        });

        // 默认隐藏所有分类
        const allCategories = document.querySelectorAll('.category');
        allCategories.forEach(category => {
            category.classList.add('hidden');
        });
    }

    // -------------------------------------------------------------------------
    // 启动！
    // -------------------------------------------------------------------------
    initializePage();
});
