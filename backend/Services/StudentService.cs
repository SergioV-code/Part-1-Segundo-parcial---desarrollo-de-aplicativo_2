using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using EDUMETRICS_DR.Models;

namespace EDUMETRICS_DR.Services
{
    public class StudentService
    {
        private readonly IMongoCollection<Student> _collection;
        private readonly ILogger<StudentService> _logger;

        // ─── Datos de seed ────────────────────────────────────────────────────
        private static readonly List<Student> _seedStudents = new()
        {
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Maria Altagracia Reyes",    Cedula = "001-1234567-8", CentroEducativo = "Liceo Union Panamericana",                    ModalidadAcademica = "Modalidad Academica",          Rne = "RNE-SEED-001" },
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Jose Ramon Perez",           Cedula = "001-2345678-9", CentroEducativo = "Politecnico Loyola",                         ModalidadAcademica = "Modalidad Tecnico Profesional", Rne = "RNE-SEED-002" },
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Luisa Fernanda Gomez",      Cedula = "001-3456789-0", CentroEducativo = "Liceo Ramon Emilio Jimenez",                 ModalidadAcademica = "Modalidad Academica",          Rne = "RNE-SEED-003" },
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Carlos Alberto Nunez",      Cedula = "001-4567890-1", CentroEducativo = "Politecnico Nicolas Pichardo",              ModalidadAcademica = "Modalidad Tecnico Profesional", Rne = "RNE-SEED-004" },
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Ana Sofia Jimenez",         Cedula = "001-5678901-2", CentroEducativo = "Colegio Santa Teresita",                    ModalidadAcademica = "Modalidad Academica",          Rne = "RNE-SEED-005" },
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Rafael Enrique Martinez",   Cedula = "001-6789012-3", CentroEducativo = "Liceo Nocturno Juan Antonio Alix",           ModalidadAcademica = "Modalidad Academica",          Rne = "RNE-SEED-006" },
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Paola Mercedes Santos",     Cedula = "001-7890123-4", CentroEducativo = "Politecnico Nuestra Senora de las Mercedes", ModalidadAcademica = "Modalidad Tecnico Profesional", Rne = "RNE-SEED-007" },
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Miguel Angel Castillo",     Cedula = "001-8901234-5", CentroEducativo = "Liceo Union Panamericana",                    ModalidadAcademica = "Modalidad Tecnico Profesional", Rne = "RNE-SEED-008" },
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Valentina Ines Rodriguez",  Cedula = "001-9012345-6", CentroEducativo = "Politecnico Loyola",                         ModalidadAcademica = "Modalidad Academica",          Rne = "RNE-SEED-009" },
            new Student { Id = ObjectId.GenerateNewId().ToString(), Nombre = "Diego Alejandro Vargas",    Cedula = "001-0123456-7", CentroEducativo = "Colegio Santa Teresita",                    ModalidadAcademica = "Modalidad Tecnico Profesional", Rne = "RNE-SEED-010" },
        };

        public StudentService(IOptions<MongoDbSettings> settings, ILogger<StudentService> logger)
        {
            _logger = logger;

            // Priorizar MONGODB_URI de Railway; caer en appsettings si no existe
            var connectionString = Environment.GetEnvironmentVariable("MONGODB_URI")
                ?? settings.Value.ConnectionString;
            var databaseName  = settings.Value.DatabaseName;
            var collectionName = settings.Value.CollectionName;

            var client   = new MongoClient(connectionString);
            var database = client.GetDatabase(databaseName);
            _collection  = database.GetCollection<Student>(collectionName);

            SeedData();
        }

        // ── Seed automático si la colección está vacía ────────────────────────
        private void SeedData()
        {
            try
            {
                var count = _collection.CountDocuments(Builders<Student>.Filter.Empty);
                if (count == 0)
                {
                    _collection.InsertMany(_seedStudents);
                    _logger.LogInformation("[StudentService] Seed ejecutado: {Count} estudiantes insertados.", _seedStudents.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[StudentService] Seed omitido (MongoDB no disponible): {Message}", ex.Message);
            }
        }

        // ── CRUD ──────────────────────────────────────────────────────────────

        public async Task<List<Student>> GetAsync() =>
            await _collection.Find(_ => true).ToListAsync();

        public async Task<Student?> GetByIdAsync(string id) =>
            await _collection.Find(s => s.Id == id).FirstOrDefaultAsync();

        public async Task<Student> CreateAsync(Student student)
        {
            student.Id = ObjectId.GenerateNewId().ToString();
            await _collection.InsertOneAsync(student);
            return student;
        }

        public async Task<bool> UpdateAsync(string id, Student updated)
        {
            updated.Id = id;
            var result = await _collection.ReplaceOneAsync(s => s.Id == id, updated);
            return result.MatchedCount > 0;
        }

        public async Task<bool> DeleteAsync(string id)
        {
            var result = await _collection.DeleteOneAsync(s => s.Id == id);
            return result.DeletedCount > 0;
        }
    }
}
