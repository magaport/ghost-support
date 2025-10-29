/**
 * レビューナビゲーション
 * 発売予告（hash-before）と開封レビュー（hash-after）の記事間のナビゲーションを処理
 * excerptのamazon_codeとrelease_dateで同じ付録の記事を識別
 */
/* eslint-env browser */
(function () {
    'use strict';

    /**
     * excerptからJSON情報をパース
     */
    function parseExcerpt(excerpt) {
        if (!excerpt) {
            return null;
        }

        try {
            return JSON.parse(excerpt);
        } catch (e) {
            // JSONパースに失敗した場合はnull
            return null;
        }
    }

    /**
     * 2つの投稿が同じ付録かどうかを判定
     */
    function isSameFuroku(excerptData1, excerptData2) {
        if (!excerptData1 || !excerptData2) {
            return false;
        }

        return excerptData1.amazon_code === excerptData2.amazon_code &&
               excerptData1.release_date === excerptData2.release_date;
    }

    /**
     * Content APIで段階的に投稿を取得し、関連記事を探す
     */
    async function findRelatedPosts(currentPostId, currentExcerptData) {
        const apiKey = window.ghostConfig && window.ghostConfig.contentApiKey;

        if (!apiKey) {
            console.error('Content API key not found');
            return { preview: null, reviews: [] };
        }

        const limit = 100;
        const results = { preview: null, reviews: [] };

        // hash-beforeとhash-afterを別々に取得
        const tags = ['hash-before', 'hash-after'];

        for (const tag of tags) {
            let page = 1;
            let hasMore = true;

            // 最大50ページ（5000件）まで取得（安全のため上限設定）
            while (hasMore && page <= 50) {
                const url = `/ghost/api/content/posts/?key=${apiKey}` +
                    `&filter=tag:${tag}` +
                    `&limit=${limit}&page=${page}` +
                    `&fields=id,slug,title,url,excerpt` +
                    `&include=tags,authors`;

                try {
                    const response = await fetch(url);

                    if (!response.ok) {
                        break;
                    }

                    const data = await response.json();

                    if (!data.posts || data.posts.length === 0) {
                        break;
                    }

                    // 各投稿をチェック
                    for (const post of data.posts) {
                        if (post.id === currentPostId) {
                            continue; // 自分自身を除外
                        }

                        const postExcerptData = parseExcerpt(post.excerpt);

                        if (isSameFuroku(currentExcerptData, postExcerptData)) {
                            const hasBeforeTag = post.tags && post.tags.some(function (t) {
                                return t.slug === 'hash-before';
                            });

                            if (hasBeforeTag && !results.preview) {
                                results.preview = post;
                            } else if (!hasBeforeTag) {
                                results.reviews.push(post);
                            }
                        }
                    }

                    // 次のページがあるかチェック
                    hasMore = data.meta && data.meta.pagination && data.meta.pagination.next;
                    page++;

                } catch (error) {
                    console.error('Error fetching posts:', error);
                    break;
                }
            }
        }

        return results;
    }

    /**
     * レビューナビゲーションのHTMLを生成
     */
    function renderReviewNav(relatedPosts, hasBefore, hasAfter) {
        let html = '';

        if (hasBefore) {
            // 現在の投稿は発売予告
            html += '<div class="review-nav-tab active">予告</div>';

            if (relatedPosts.reviews.length > 0) {
                html += '<div class="review-nav-tab none-active">' +
                    '<a href="' + relatedPosts.reviews[0].url + '">開封レビュー</a>' +
                    '</div>';
            } else {
                html += '<div class="review-nav-tab review-nav-none">&nbsp;</div>';
            }
        } else if (hasAfter) {
            // 現在の投稿は開封レビュー
            if (relatedPosts.preview) {
                html += '<div class="review-nav-tab none-active">' +
                    '<a href="' + relatedPosts.preview.url + '">予告</a>' +
                    '</div>';
            } else {
                html += '<div class="review-nav-tab review-nav-none">&nbsp;</div>';
            }

            html += '<div class="review-nav-tab active">開封レビュー</div>';
        }

        return html;
    }

    /**
     * 関連レビュー記事リストのHTMLを生成（author-infoスタイル）
     */
    function renderRelatedReviews(relatedReviews, currentPostId) {
        if (relatedReviews.length === 0) {
            return '';
        }

        // 現在の投稿を除外
        const otherReviews = relatedReviews.filter(function (post) {
            return post.id !== currentPostId;
        });

        if (otherReviews.length === 0) {
            return '';
        }

        let html = '';

        otherReviews.forEach(function (post) {
            // 著者情報を取得（primary authorを使用）
            const author = post.authors && post.authors.length > 0 ? post.authors[0] : null;

            if (!author) {
                return; // 著者情報がない場合はスキップ
            }

            html += '<div class="author-info pastel-bc" style="margin-top: 20px;">';
            html += '  <div class="author-info__inner">';
            html += '    <div class="tb">';
            html += '      <div class="tb-left">';
            html += '        <div class="author_label">';
            html += '          <span>私もレビューしました</span>';
            html += '        </div>';
            html += '        <div class="author_img">';

            if (author.profile_image) {
                html += '          <img alt="' + author.name + '" src="' + author.profile_image + '" class="avatar avatar-100 photo" height="100" width="100" loading="lazy" decoding="async">';
            } else {
                html += '          <span class="author-placeholder">' + author.name + '</span>';
            }

            html += '        </div>';
            html += '        <dl class="aut">';
            html += '          <dt>';
            html += '            <a class="dfont" href="/review/author/' + author.slug + '/"><span>' + author.name + '</span></a>';
            html += '          </dt>';
            html += '          <dd>' + (author.location || '') + '</dd>';
            html += '        </dl>';
            html += '      </div>';
            html += '      <div class="tb-right">';

            // 記事へのリンクを追加（タイトルを表示）
            html += '        <div style="margin-bottom: 15px;">';
            html += '          <a href="' + post.url + '" class="related-review-link" style="color: #4f96f6; font-weight: bold; font-size: 14px; display: block;">';
            html += post.title;
            html += '          </a>';
            html += '        </div>';

            if (author.bio) {
                html += '        <p>' + author.bio + '</p>';
            }

            html += '        <div class="follow_btn dfont">';

            if (author.twitter) {
                html += '          <a class="gh-author-social-link" href="https://twitter.com/' + author.twitter + '" target="_blank" rel="noopener">';
                html += '            <i class="fa fa-twitter"></i>';
                html += '          </a>';
            }

            if (author.instagram) {
                html += '          <a class="gh-author-social-link" href="https://instagram.com/' + author.instagram + '" target="_blank" rel="noopener">';
                html += '            <i class="fa fa-instagram"></i>';
                html += '          </a>';
            }

            html += '        </div>';
            html += '      </div>';
            html += '    </div>';
            html += '  </div>';
            html += '</div>';
        });

        return html;
    }

    /**
     * レビューナビゲーションを初期化
     */
    async function initReviewNav() {
        const reviewNavElement = document.querySelector('.review-nav');

        if (!reviewNavElement) {
            return;
        }

        const postId = reviewNavElement.getAttribute('data-post-id');
        const postExcerpt = reviewNavElement.getAttribute('data-post-excerpt');
        const postTags = (reviewNavElement.getAttribute('data-post-tags') || '').split(',').filter(function (tag) {
            return tag.trim();
        });

        const hasBefore = postTags.indexOf('hash-before') !== -1;
        const hasAfter = postTags.indexOf('hash-after') !== -1;

        // どちらのタグも持っていない場合は非表示
        if (!hasBefore && !hasAfter) {
            reviewNavElement.style.display = 'none';
            return;
        }

        // excerptをパース
        const excerptData = parseExcerpt(postExcerpt);

        if (!excerptData || !excerptData.amazon_code || !excerptData.release_date) {
            console.warn('Invalid excerpt data');
            reviewNavElement.style.display = 'none';
            return;
        }

        try {
            // 関連記事を検索
            const relatedPosts = await findRelatedPosts(postId, excerptData);

            // レビューナビゲーションを表示
            const navHtml = renderReviewNav(relatedPosts, hasBefore, hasAfter);
            reviewNavElement.innerHTML = navHtml;

            // レビュー記事の場合、関連レビュー記事リストも表示
            if (hasAfter && relatedPosts.reviews.length > 0) {
                const relatedReviewsContainer = document.querySelector('.related-reviews');

                if (relatedReviewsContainer) {
                    const reviewsHtml = renderRelatedReviews(relatedPosts.reviews, postId);
                    relatedReviewsContainer.innerHTML = reviewsHtml;
                }
            }

        } catch (error) {
            console.error('Error initializing review nav:', error);
        }
    }

    // DOMの準備ができるまで待機
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReviewNav);
    } else {
        initReviewNav();
    }
})();
