using System.ComponentModel.DataAnnotations;

namespace EDUMETRICS_DR.Models;

public static class ScholarshipApplicationStatuses
{
    public const string Pendiente = "Pendiente";
    public const string Rechazada = "Rechazada";
    public const string EnAnalisisEconomico = "En Análisis Económico";
    public const string Completada = "Completada";
}

public static class ScholarshipTraceability
{
    public const string InstitutionalEmail = "sergiovargasdiaz316@gmail.com";
}

public class ScholarshipApplication
{
    [Key]
    public int Id { get; set; }

    public int StudentId { get; set; }

    [MaxLength(200)]
    public string StudentName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string StudentCedula { get; set; } = string.Empty;

    [MaxLength(180)]
    public string ScholarshipName { get; set; } = string.Empty;

    [MaxLength(180)]
    public string InstitutionName { get; set; } = string.Empty;

    [MaxLength(180)]
    public string? CareerName { get; set; }

    [MaxLength(200)]
    public string NotificationEmail { get; set; } = ScholarshipTraceability.InstitutionalEmail;

    [MaxLength(80)]
    public string Status { get; set; } = ScholarshipApplicationStatuses.Pendiente;

    [MaxLength(2000)]
    public string StudentComment { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? RejectionReason { get; set; }

    public bool FinancialAnalysisCompleted { get; set; }

    public bool SecondaryStudiesVerificationCompleted { get; set; }

    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? ReviewedAtUtc { get; set; }

    public DateTime? CompletedAtUtc { get; set; }

    public Student? Student { get; set; }

    public List<ScholarshipApplicationHistory> History { get; set; } = new();
}

public class ScholarshipApplicationHistory
{
    [Key]
    public int Id { get; set; }

    public int ScholarshipApplicationId { get; set; }

    [MaxLength(100)]
    public string Action { get; set; } = string.Empty;

    [MaxLength(80)]
    public string PreviousStatus { get; set; } = string.Empty;

    [MaxLength(80)]
    public string NewStatus { get; set; } = string.Empty;

    [MaxLength(50)]
    public string ActorRole { get; set; } = string.Empty;

    [MaxLength(200)]
    public string ActorEmail { get; set; } = ScholarshipTraceability.InstitutionalEmail;

    [MaxLength(2000)]
    public string Notes { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ScholarshipApplication? ScholarshipApplication { get; set; }
}