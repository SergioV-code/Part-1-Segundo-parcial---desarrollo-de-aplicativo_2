using EDUMETRICS_DR.Models;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Data
{
    public class SchoolContext : DbContext
    {
        public SchoolContext(DbContextOptions<SchoolContext> options) : base(options)
        {
        }

        public DbSet<Student> Students => Set<Student>();
        public DbSet<Asignatura> Asignaturas => Set<Asignatura>();
        public DbSet<User> Users => Set<User>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Student>(entity =>
            {
                entity.HasIndex(e => e.Cedula).IsUnique();
                entity.HasIndex(e => e.Rne).IsUnique();
            });

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(e => e.Cedula).IsUnique();
                entity.HasIndex(e => e.CorreoInstitucional).IsUnique();

                entity.Property(e => e.Rol)
                    .HasMaxLength(50)
                    .IsRequired();

                entity.ToTable(t => t.HasCheckConstraint(
                    "CK_Users_Rol",
                    "[Rol] IN ('Estudiante', 'Analista MINERD', 'Analista MESCYT')"
                ));
            });

            modelBuilder.Entity<Asignatura>(entity =>
            {
                entity.HasOne(e => e.Student)
                    .WithMany(s => s.Asignaturas)
                    .HasForeignKey(e => e.StudentId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}
