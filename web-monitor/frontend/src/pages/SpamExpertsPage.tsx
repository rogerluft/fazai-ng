function SpamExpertsPage() {
  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">📧</span>
            <h1 className="text-3xl font-bold">SpamExperts Management</h1>
          </div>
          <p className="text-gray-400">Gerenciamento de proteção anti-spam</p>
        </header>

        <main>
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🚧</div>
              <h2 className="text-2xl font-semibold mb-3">Em Construção</h2>
              <p className="text-gray-400">
                Esta funcionalidade está sendo desenvolvida. Em breve você poderá
                gerenciar suas configurações de proteção anti-spam por aqui.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default SpamExpertsPage;
