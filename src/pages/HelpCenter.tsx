import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Book,
  Rocket,
  Package,
  PackagePlus,
  ShoppingCart,
  Warehouse,
  Settings,
  ChevronRight,
  Home,
  HelpCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  helpCategories,
  searchHelpContent,
  getArticleById,
  getRelatedArticles,
} from '@/data/helpContent';
import ReactMarkdown from 'react-markdown';

const iconMap: Record<string, any> = {
  Rocket,
  Package,
  PackagePlus,
  ShoppingCart,
  Warehouse,
  Settings,
};

export default function HelpCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(
    searchParams.get('article')
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchHelpContent(searchQuery);
  }, [searchQuery]);

  const currentArticle = useMemo(() => {
    if (!selectedArticle) return null;
    return getArticleById(selectedArticle);
  }, [selectedArticle]);

  const relatedArticles = useMemo(() => {
    if (!selectedArticle) return [];
    return getRelatedArticles(selectedArticle);
  }, [selectedArticle]);

  const filteredCategories = useMemo(() => {
    if (!selectedCategory) return helpCategories;
    return helpCategories.filter(c => c.id === selectedCategory);
  }, [selectedCategory]);

  const handleArticleClick = (articleId: string) => {
    setSelectedArticle(articleId);
    setSearchParams({ article: articleId });
    setSearchQuery('');
  };

  const handleBack = () => {
    setSelectedArticle(null);
    setSearchParams({});
  };

  const handleCategoryFilter = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setSelectedArticle(null);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Sticky */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/20 backdrop-blur-sm p-2 shadow-md">
                <Book className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Gold Shipper - Help Center</h1>
                <p className="text-amber-50 text-sm">Professional Documentation & Workflows</p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => navigate('/dashboard')}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-md"
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl mt-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search documentation, guides, workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-12 py-3 bg-white/90 backdrop-blur-sm border-white/40 text-gray-900 placeholder-gray-500 shadow-md"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-4 sticky top-6">
              <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
              <div className="space-y-2">
                <button
                  onClick={() => handleCategoryFilter(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === null
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Book className="h-4 w-4" />
                    <span>All Topics</span>
                  </div>
                </button>
                {helpCategories.map((category) => {
                  const IconComponent = iconMap[category.icon] || HelpCircle;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryFilter(category.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <span className="text-sm">{category.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        {category.articles.length} articles
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Popular Topics */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Popular Topics</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => handleArticleClick('batch-workflow')}
                    className="w-full text-left text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Batch Workflow
                  </button>
                  <button
                    onClick={() => handleArticleClick('presales-overview')}
                    className="w-full text-left text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Pre-Sales Guide
                  </button>
                  <button
                    onClick={() => handleArticleClick('sales-overview')}
                    className="w-full text-left text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Sales Process
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            {/* Search Results */}
            {searchQuery && searchResults.length > 0 && (
              <Card className="p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Search Results ({searchResults.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.map((article) => (
                    <button
                      key={article.id}
                      onClick={() => handleArticleClick(article.id)}
                      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{article.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{article.category}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {article.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {searchQuery && searchResults.length === 0 && (
              <Card className="p-12 text-center">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600">
                  Try different keywords or browse categories below
                </p>
              </Card>
            )}

            {/* Article View */}
            {!searchQuery && currentArticle && (
              <div>
                <Button
                  variant="secondary"
                  onClick={handleBack}
                  size="sm"
                  className="mb-4"
                >
                  ← Back to Help Center
                </Button>

                <Card className="p-8">
                  <div className="mb-6 pb-6 border-b">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {currentArticle.title}
                    </h1>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {currentArticle.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                      Last updated: {new Date(currentArticle.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="prose prose-lg max-w-none help-content">
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-3xl font-bold text-amber-700 mb-4 mt-8" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-amber-600 mb-3 mt-6 pb-2 border-b-2 border-amber-200" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4" {...props} />,
                        h4: ({node, ...props}) => <h4 className="text-lg font-semibold text-gray-700 mb-2 mt-3" {...props} />,
                        p: ({node, ...props}) => <p className="text-gray-700 leading-relaxed mb-4" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-2 ml-4 mb-4 text-gray-700" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-2 ml-4 mb-4 text-gray-700" {...props} />,
                        li: ({node, ...props}) => <li className="ml-2" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-gray-900" {...props} />,
                        em: ({node, ...props}) => <em className="italic text-gray-600" {...props} />,
                        code: ({node, inline, ...props}: any) =>
                          inline ?
                            <code className="bg-amber-50 text-amber-800 px-2 py-1 rounded text-sm font-mono" {...props} /> :
                            <code className="block bg-gray-100 text-gray-800 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-amber-500 pl-4 italic text-gray-600 my-4" {...props} />,
                      }}
                    >{currentArticle.content}</ReactMarkdown>
                  </div>

                  {/* Related Modules */}
                  {currentArticle.relatedModules && currentArticle.relatedModules.length > 0 && (
                    <div className="mt-8 pt-8 border-t">
                      <h3 className="font-semibold text-gray-900 mb-3">Related Modules</h3>
                      <div className="flex flex-wrap gap-2">
                        {currentArticle.relatedModules.map((module) => (
                          <span
                            key={module}
                            className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-lg capitalize"
                          >
                            {module}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Articles */}
                  {relatedArticles.length > 0 && (
                    <div className="mt-8 pt-8 border-t">
                      <h3 className="font-semibold text-gray-900 mb-4">Related Articles</h3>
                      <div className="grid gap-3">
                        {relatedArticles.map((article) => (
                          <button
                            key={article.id}
                            onClick={() => handleArticleClick(article.id)}
                            className="text-left p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-gray-900">{article.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">{article.category}</p>
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Category View */}
            {!searchQuery && !currentArticle && (
              <div className="space-y-6">
                {filteredCategories.map((category) => {
                  const IconComponent = iconMap[category.icon] || HelpCircle;
                  return (
                    <Card key={category.id} className="p-6">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="rounded-lg bg-blue-100 p-3">
                          <IconComponent className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-2xl font-bold text-gray-900">{category.title}</h2>
                          <p className="text-gray-600 mt-1">{category.description}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 mt-6">
                        {category.articles.map((article) => (
                          <button
                            key={article.id}
                            onClick={() => handleArticleClick(article.id)}
                            className="text-left p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                                  {article.title}
                                </h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {article.tags.slice(0, 4).map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-4 transition-colors" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Help */}
      <div className="mt-12 bg-gray-100 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Still need help?</h3>
            <p className="text-gray-600 mb-4">
              Contact your system administrator or reach out to support
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="secondary" size="sm">
                Contact Support
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/audit')}>
                View System Logs
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
