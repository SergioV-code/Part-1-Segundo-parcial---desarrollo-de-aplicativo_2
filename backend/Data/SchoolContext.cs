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
        public DbSet<ScholarshipApplication> ScholarshipApplications => Set<ScholarshipApplication>();
        public DbSet<ScholarshipApplicationHistory> ScholarshipApplicationHistories => Set<ScholarshipApplicationHistory>();

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
                    "[Rol] IN ('Estudiante', 'Analista MINERD', 'Analista MESCYT', 'Administrador')"
                ));
            });

            modelBuilder.Entity<Asignatura>(entity =>
            {
                entity.HasOne(e => e.Student)
                    .WithMany(s => s.Asignaturas)
                    .HasForeignKey(e => e.StudentId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ScholarshipApplication>(entity =>
            {
                entity.HasIndex(e => e.Status);
                entity.Property(e => e.Status)
                    .HasMaxLength(80)
                    .IsRequired();

                entity.Property(e => e.CareerName)
                    .HasMaxLength(180);

                entity.Property(e => e.NotificationEmail)
                    .HasMaxLength(200)
                    .IsRequired();

                entity.HasOne(e => e.Student)
                    .WithMany()
                    .HasForeignKey(e => e.StudentId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ScholarshipApplicationHistory>(entity =>
            {
                entity.Property(e => e.Action)
                    .HasMaxLength(100)
                    .IsRequired();

                entity.Property(e => e.ActorEmail)
                    .HasMaxLength(200)
                    .IsRequired();

                entity.HasOne(e => e.ScholarshipApplication)
                    .WithMany(e => e.History)
                    .HasForeignKey(e => e.ScholarshipApplicationId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}
