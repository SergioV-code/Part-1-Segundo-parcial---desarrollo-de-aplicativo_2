using MongoDB.Driver;
using EDUMETRICS_DR.Models;

namespace EDUMETRICS_DR.Data
{
    /// <summary>
    /// Contexto de base de datos MongoDB para EDUMETRICS-DR
    /// Gestiona la conexión y operaciones con la colección de estudiantes
    /// </summary>
    public class SchoolContext
    {
        private readonly IMongoDatabase _database;

        public SchoolContext(IMongoDatabase database)
        {
            _database = database ?? throw new ArgumentNullException(nameof(database));
        }

        /// <summary>
        /// Colección de estudiantes registrados en el sistema
        /// </summary>
        public IMongoCollection<Student> Students =>
            _database.GetCollection<Student>("students");

        /// <summary>
        /// Inicializa la base de datos con índices y datos predeterminados si es necesario
        /// </summary>
        public async Task InitializeAsync()
        {
            try
            {
                // Crear índices
                var indexModel = new CreateIndexModel<Student>(
                    Builders<Student>.IndexKeys.Ascending(s => s.Rne),
                    new CreateIndexOptions { Unique = false }
                );

                await Students.Indexes.CreateOneAsync(indexModel);
                
                Console.WriteLine("[MongoDB] Base de datos inicializada correctamente");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB] Error durante inicialización: {ex.Message}");
            }
        }
    }
}
