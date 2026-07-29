using EDUMETRICS_DR.Data;
using EDUMETRICS_DR.Models;
using Microsoft.EntityFrameworkCore;

namespace EDUMETRICS_DR.Services;

public class StudentService
{
    private readonly SchoolContext _context;

    public StudentService(SchoolContext context)
    {
        _context = context;
    }

    public async Task<List<Student>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Students
            .AsNoTracking()
            .OrderBy(x => x.Nombre)
            .ToListAsync(cancellationToken);
    }

    public async Task<Student?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.Students
            .Include(x => x.Asignaturas)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
    }

    public async Task<Student?> GetByCedulaAsync(string cedula, CancellationToken cancellationToken = default)
    {
        return await _context.Students
            .Include(x => x.Asignaturas)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Cedula == cedula, cancellationToken);
    }

    public async Task<Student> CreateAsync(Student student, CancellationToken cancellationToken = default)
    {
        student.FechaCreacion = DateTime.UtcNow;
        student.FechaActualizacion = DateTime.UtcNow;

        _context.Students.Add(student);
        await _context.SaveChangesAsync(cancellationToken);

        return student;
    }

    public async Task<bool> UpdateAsync(int id, Student updatedStudent, CancellationToken cancellationToken = default)
    {
        var current = await _context.Students
            .Include(x => x.Asignaturas)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (current is null)
        {
            return false;
        }

        current.Nombre = updatedStudent.Nombre;
        current.Cedula = updatedStudent.Cedula;
        current.Rne = updatedStudent.Rne;
        current.DistritoEducativo = updatedStudent.DistritoEducativo;
        current.ModalidadAcademica = updatedStudent.ModalidadAcademica;
        current.CentroEducativo = updatedStudent.CentroEducativo;
        current.Estado = updatedStudent.Estado;
        current.TasaAsistencia = updatedStudent.TasaAsistencia;
        current.PromedioGeneral = updatedStudent.PromedioGeneral;
        current.FirmaCriptografica = updatedStudent.FirmaCriptografica;
        current.EstadoBecaMescyt = updatedStudent.EstadoBecaMescyt;
        current.ProtocoloArquitectura = updatedStudent.ProtocoloArquitectura;
        current.LogsSincronizacion = updatedStudent.LogsSincronizacion;
        current.FechaActualizacion = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var student = await _context.Students.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (student is null)
        {
            return false;
        }

        _context.Students.Remove(student);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}
